import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { clock } from '../services/clock.js';
import { audit } from '../services/audit.js';
import { HttpError, ensureDosesForDay } from '../services/doses.js';
import { notify } from '../services/alerts.js';
import { activeTrackerIds, linkedPatientIds, reviewerIds } from '../services/access.js';
import { emit, emitMany } from '../services/events.js';
import { patientBasics, medicinesWithSchedules, requestContext } from '../services/summary.js';
import { checkCandidate } from '../services/interactions.js';

export const requestsRouter = Router();

const withNames = (r) => ({ ...r, patient_name: db.prepare('SELECT name FROM users WHERE id=?').get(r.patient_id)?.name,
  reviewer_name: r.reviewer_id ? db.prepare('SELECT name FROM users WHERE id=?').get(r.reviewer_id)?.name : null });

export function createRequest(patientId, { name, dosage = '', reason = '' }) {
  const info = db.prepare('INSERT INTO medicine_requests(patient_id,name,dosage,reason,status,created_at) VALUES(?,?,?,?,?,?)')
    .run(patientId, name, dosage, reason, 'pending', clock.stamp());
  const id = info.lastInsertRowid;
  const patient = db.prepare('SELECT name FROM users WHERE id=?').get(patientId);
  audit(patientId, 'request.created', 'medicine_requests', id, { name, dosage });
  notify(reviewerIds(), patientId, 'new_request', `${patient.name} requested ${name}${dosage ? ' ' + dosage : ''}.`);
  emitMany([patientId, ...reviewerIds(), ...activeTrackerIds(patientId)], 'request', { requestId: id, patientId, status: 'pending' });
  return db.prepare('SELECT * FROM medicine_requests WHERE id=?').get(id);
}

requestsRouter.post('/', requireRole('patient'),
  validate(z.object({ name: z.string().trim().min(2).max(80), dosage: z.string().trim().max(40).default(''), reason: z.string().trim().min(3).max(500) })),
  wrap((req, res) => res.status(201).json({ request: withNames(createRequest(req.user.id, req.body)) })));

requestsRouter.get('/', requireAuth, wrap((req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  let rows;
  if (req.user.role === 'patient') rows = db.prepare('SELECT * FROM medicine_requests WHERE patient_id=? ORDER BY created_at DESC').all(req.user.id);
  else if (req.user.role === 'reviewer') rows = db.prepare('SELECT * FROM medicine_requests ORDER BY created_at DESC').all();
  else {
    const ids = linkedPatientIds(req.user.id);
    rows = ids.length ? db.prepare(`SELECT * FROM medicine_requests WHERE patient_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC`).all(...ids) : [];
  }
  if (status) rows = rows.filter((r) => r.status === status);
  res.json({ requests: rows.map(withNames) });
}));

requestsRouter.get('/:id', requireRole('reviewer'), wrap((req, res) => {
  const r = db.prepare('SELECT * FROM medicine_requests WHERE id=?').get(Number(req.params.id));
  if (!r) throw new HttpError(404, 'NOT_FOUND', 'Request not found');
  const flags = checkCandidate(r.patient_id, r.name);
  res.json({
    request: withNames(r),
    patient: patientBasics(r.patient_id),
    currentMedicines: medicinesWithSchedules(r.patient_id),
    interactions: flags.interactions, allergies: flags.allergies,
    notes: db.prepare(`SELECT d.scheduled_for,d.note,m.name FROM dose_logs d JOIN medicines m ON m.id=d.medicine_id
      WHERE d.patient_id=? AND d.note IS NOT NULL ORDER BY d.scheduled_for DESC LIMIT 5`).all(r.patient_id),
  });
}));

const PALETTE = ['#2dd4bf', '#f472b6', '#fbbf24', '#818cf8', '#fb7185', '#34d399', '#60a5fa', '#f97316'];
const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).default(''),
  schedule: z.object({
    times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(6),
    days_mask: z.string().regex(/^[M-][T-][W-][T-][F-][S-][S-]$/).default('MTWTFSS'),
    dosage: z.string().trim().min(1).max(40).optional(),
    form: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'drops']).default('tablet'),
    stock_count: z.number().int().min(0).max(999).default(30),
    instructions: z.string().max(240).default(''),
  }).optional(),
}).refine((v) => v.decision !== 'rejected' || v.note.length >= 3, { message: 'A note is required when rejecting', path: ['note'] });

requestsRouter.patch('/:id/decide', requireRole('reviewer'), validate(decideSchema), wrap((req, res) => {
  const r = db.prepare('SELECT * FROM medicine_requests WHERE id=?').get(Number(req.params.id));
  if (!r) throw new HttpError(404, 'NOT_FOUND', 'Request not found');
  if (r.status !== 'pending') throw new HttpError(409, 'ALREADY_DECIDED', 'This request has already been decided.');
  const { decision, note, schedule } = req.body;
  let medicineId = null;
  db.transaction(() => {
    db.prepare('UPDATE medicine_requests SET status=?, reviewer_id=?, reviewer_note=?, decided_at=? WHERE id=?')
      .run(decision, req.user.id, note || null, clock.stamp(), r.id);
    if (decision === 'approved') {
      const s = schedule ?? { times: ['09:00'], days_mask: 'MTWTFSS', form: 'tablet', stock_count: 30, instructions: '' };
      const count = db.prepare('SELECT COUNT(*) c FROM medicines WHERE patient_id=?').get(r.patient_id).c;
      const info = db.prepare(`INSERT INTO medicines(patient_id,name,dosage,form,color,instructions,stock_count,refill_threshold,start_date,status,created_at)
        VALUES(?,?,?,?,?,?,?,?,?, 'active', ?)`).run(r.patient_id, r.name, s.dosage ?? (r.dosage || 'As directed'), s.form, PALETTE[count % PALETTE.length],
        s.instructions, s.stock_count, 5, clock.today(), clock.stamp());
      medicineId = info.lastInsertRowid;
      const ins = db.prepare('INSERT INTO schedules(medicine_id,time_of_day,days_mask) VALUES(?,?,?)');
      for (const t of s.times) ins.run(medicineId, t, s.days_mask);
    }
    audit(req.user.id, `request.${decision}`, 'medicine_requests', r.id, { medicine: r.name, patient_id: r.patient_id, note, medicineId });
  })();
  const patient = db.prepare('SELECT name FROM users WHERE id=?').get(r.patient_id);
  if (decision === 'approved') ensureDosesForDay(r.patient_id, clock.today());
  const msg = decision === 'approved'
    ? `Dr. ${req.user.name.replace(/^Dr\.?\s*/, '')} approved ${r.name} for ${patient.name}.`
    : `${req.user.name} declined ${r.name} for ${patient.name}: ${note}`;
  notify([r.patient_id, ...activeTrackerIds(r.patient_id)], r.patient_id, 'request_decided', msg);
  const audience = [r.patient_id, ...activeTrackerIds(r.patient_id), ...reviewerIds()];
  emitMany(audience, 'request', { requestId: r.id, patientId: r.patient_id, status: decision });
  if (medicineId) emitMany([r.patient_id, ...activeTrackerIds(r.patient_id)], 'medicine', { patientId: r.patient_id, medicineId, change: 'created', name: r.name, viaRequest: true });
  res.json({ request: withNames(db.prepare('SELECT * FROM medicine_requests WHERE id=?').get(r.id)), medicineId });
}));
