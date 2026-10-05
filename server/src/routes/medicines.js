import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { clock } from '../services/clock.js';
import { audit } from '../services/audit.js';
import { ensureDosesForDay, HttpError } from '../services/doses.js';
import { medicinesWithSchedules } from '../services/summary.js';
import { checkCandidate } from '../services/interactions.js';
import { activeTrackerIds } from '../services/access.js';
import { emitMany } from '../services/events.js';

export const medicinesRouter = Router();
medicinesRouter.use(requireRole('patient'));

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const mask = z.string().regex(/^[M-][T-][W-][T-][F-][S-][S-]$/, 'days_mask like MTWTFSS or M-W-F--');
const schedule = z.object({ time_of_day: time, days_mask: mask.default('MTWTFSS') });
const base = {
  name: z.string().trim().min(2).max(80),
  dosage: z.string().trim().min(1).max(40),
  form: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'drops']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2dd4bf'),
  instructions: z.string().max(240).default(''),
  stock_count: z.number().int().min(0).max(9999).default(30),
  refill_threshold: z.number().int().min(0).max(999).default(5),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
};
const createSchema = z.object({ ...base, schedules: z.array(schedule).min(1).max(6) });
const patchSchema = z.object({
  ...Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.optional?.() ?? v])),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  schedules: z.array(schedule).min(1).max(6).optional(),
}).partial();

const fanout = (user, payload) => emitMany([user.id, ...activeTrackerIds(user.id)], 'medicine', { patientId: user.id, ...payload });

medicinesRouter.get('/', (req, res) => res.json({ medicines: medicinesWithSchedules(req.user.id, true) }));

medicinesRouter.post('/check', validate(z.object({ name: z.string().trim().min(2) })), (req, res) =>
  res.json(checkCandidate(req.user.id, req.body.name)));

medicinesRouter.post('/', validate(createSchema), wrap((req, res) => {
  const b = req.body;
  const warnings = checkCandidate(req.user.id, b.name);
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO medicines(patient_id,name,dosage,form,color,instructions,stock_count,refill_threshold,start_date,end_date,status,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?, 'active', ?)`).run(req.user.id, b.name, b.dosage, b.form, b.color, b.instructions, b.stock_count, b.refill_threshold,
      b.start_date ?? clock.today(), b.end_date ?? null, clock.stamp());
    const ins = db.prepare('INSERT INTO schedules(medicine_id,time_of_day,days_mask) VALUES(?,?,?)');
    for (const s of b.schedules) ins.run(info.lastInsertRowid, s.time_of_day, s.days_mask);
    audit(req.user.id, 'medicine.created', 'medicines', info.lastInsertRowid, { name: b.name, warnings: warnings.interactions.length });
    return info.lastInsertRowid;
  })();
  ensureDosesForDay(req.user.id, clock.today());
  fanout(req.user, { medicineId: id, change: 'created' });
  res.status(201).json({ medicine: medicinesWithSchedules(req.user.id, true).find((m) => m.id === id), warnings });
}));

const owned = (req) => {
  const m = db.prepare('SELECT * FROM medicines WHERE id=? AND patient_id=?').get(Number(req.params.id), req.user.id);
  if (!m) throw new HttpError(404, 'NOT_FOUND', 'Medicine not found');
  return m;
};

medicinesRouter.patch('/:id', validate(patchSchema), wrap((req, res) => {
  const m = owned(req);
  const { schedules, ...fields } = req.body;
  db.transaction(() => {
    const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
    if (keys.length) db.prepare(`UPDATE medicines SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`).run(...keys.map((k) => fields[k]), m.id);
    if (schedules) {
      const existing = db.prepare('SELECT * FROM schedules WHERE medicine_id=?').all(m.id);
      const keep = new Set();
      for (const s of schedules) {
        const match = existing.find((e) => e.time_of_day === s.time_of_day && !keep.has(e.id));
        if (match) { keep.add(match.id); db.prepare('UPDATE schedules SET days_mask=? WHERE id=?').run(s.days_mask, match.id); }
        else keep.add(db.prepare('INSERT INTO schedules(medicine_id,time_of_day,days_mask) VALUES(?,?,?)').run(m.id, s.time_of_day, s.days_mask).lastInsertRowid);
      }
      for (const e of existing.filter((e) => !keep.has(e.id))) {
        db.prepare("DELETE FROM dose_logs WHERE schedule_id=? AND status='pending' AND scheduled_for >= ?").run(e.id, clock.today());
        const hasHistory = db.prepare('SELECT 1 FROM dose_logs WHERE schedule_id=? LIMIT 1').get(e.id);
        if (hasHistory) db.prepare("UPDATE schedules SET days_mask='-------' WHERE id=?").run(e.id); // retire, keep history
        else db.prepare('DELETE FROM schedules WHERE id=?').run(e.id);
      }
    }
    audit(req.user.id, 'medicine.updated', 'medicines', m.id, { fields: Object.keys(fields), schedules: !!schedules });
  })();
  ensureDosesForDay(req.user.id, clock.today());
  fanout(req.user, { medicineId: m.id, change: 'updated' });
  res.json({ medicine: medicinesWithSchedules(req.user.id, true).find((x) => x.id === m.id) });
}));

medicinesRouter.delete('/:id', wrap((req, res) => {
  const m = owned(req);
  db.transaction(() => {
    db.prepare("DELETE FROM dose_logs WHERE medicine_id=? AND status='pending' AND scheduled_for >= ?").run(m.id, clock.today());
    db.prepare("UPDATE medicines SET status='completed', end_date=? WHERE id=?").run(clock.today(), m.id);
    audit(req.user.id, 'medicine.stopped', 'medicines', m.id, { name: m.name });
  })();
  fanout(req.user, { medicineId: m.id, change: 'stopped' });
  res.json({ ok: true });
}));
