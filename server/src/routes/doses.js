import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { clock, addDays, parseStamp, minutesBetween } from '../services/clock.js';
import { dosesForDay, takeDose, undoDose, setDoseNote, streakInfo, HttpError } from '../services/doses.js';
import { canViewPatient } from '../services/access.js';
import { db } from '../db/index.js';

export const dosesRouter = Router();

dosesRouter.get('/today', requireRole('patient'), wrap((req, res) => {
  const today = clock.today();
  const doses = dosesForDay(req.user.id, today);
  const now = clock.stamp();
  const next = doses.filter((d) => d.status === 'pending' && d.minutes_past < 0).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0] || null;
  res.json({
    now, date: today, doses,
    progress: { taken: doses.filter((d) => d.status === 'taken').length, total: doses.length },
    streak: streakInfo(req.user.id),
    next: next && { id: next.id, name: next.name, time: next.time, minutes: -next.minutes_past },
  });
}));

const range = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), patientId: z.coerce.number().int().optional() });
dosesRouter.get('/history', requireAuth, validate(range, 'query'), wrap((req, res) => {
  const patientId = req.query.patientId ?? req.user.id;
  if (!canViewPatient(req.user, patientId)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this patient.');
  if (req.user.role === 'reviewer') throw new HttpError(403, 'FORBIDDEN', 'Reviewers cannot view dose history.');
  const to = req.query.to ?? clock.today();
  const from = req.query.from ?? addDays(to, -29);
  const rows = db.prepare(`SELECT d.*, m.name, m.dosage, m.form, m.color FROM dose_logs d JOIN medicines m ON m.id=d.medicine_id
    WHERE d.patient_id=? AND d.scheduled_for >= ? AND d.scheduled_for < ? ORDER BY d.scheduled_for`).all(patientId, from, addDays(to, 1));
  res.json({ from, to, doses: rows.map((r) => ({ ...r, time: r.scheduled_for.slice(11, 16), late: r.status === 'taken' && minutesBetween(r.scheduled_for, r.taken_at) > 30 })) });
}));

dosesRouter.post('/:id/take', requireRole('patient'), validate(z.object({ note: z.string().max(200).optional() }).default({})),
  wrap((req, res) => res.json(takeDose(req.user, Number(req.params.id), req.body))));
dosesRouter.post('/:id/undo', requireRole('patient'), wrap((req, res) => res.json(undoDose(req.user, Number(req.params.id)))));
dosesRouter.patch('/:id/note', requireRole('patient'), validate(z.object({ note: z.string().max(200) })),
  wrap((req, res) => res.json({ dose: setDoseNote(req.user, Number(req.params.id), req.body.note.trim()) })));
