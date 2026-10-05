import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { canViewPatient, linkedPatientIds } from '../services/access.js';
import { patientSummary } from '../services/summary.js';
import { HttpError } from '../services/doses.js';
import { audit } from '../services/audit.js';

export const trackersRouter = Router();
export const patientsRouter = Router();
export const linksRouter = Router();

// Tracker dashboard: every linked patient
trackersRouter.get('/patients', requireRole('tracker'), wrap((req, res) => {
  res.json({ patients: linkedPatientIds(req.user.id).map((id) => patientSummary(id)).filter(Boolean) });
}));

patientsRouter.get('/:id/summary', requireAuth, wrap((req, res) => {
  const id = Number(req.params.id);
  if (!canViewPatient(req.user, id)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this patient.');
  const s = patientSummary(id);
  if (!s) throw new HttpError(404, 'NOT_FOUND', 'Patient not found');
  if (req.user.role === 'reviewer') { s.today = []; s.stats = { ...s.stats, heatmap: [] }; } // reviewers do not see dose logs
  res.json(s);
}));

// Patient profile (own) — used by emergency card + settings
patientsRouter.get('/me/profile', requireRole('patient'), wrap((req, res) => {
  res.json({ profile: patientSummary(req.user.id).patient });
}));
patientsRouter.patch('/me/profile', requireRole('patient'), validate(z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), allergies: z.string().max(300).optional(),
  conditions: z.string().max(300).optional(), emergency_contact: z.string().max(120).optional(), phone: z.string().max(30).optional(),
})), wrap((req, res) => {
  const cur = db.prepare('SELECT 1 FROM patient_profiles WHERE user_id=?').get(req.user.id);
  if (!cur) db.prepare('INSERT INTO patient_profiles(user_id) VALUES(?)').run(req.user.id);
  const keys = Object.keys(req.body);
  if (keys.length) db.prepare(`UPDATE patient_profiles SET ${keys.map((k) => `${k}=?`).join(',')} WHERE user_id=?`).run(...keys.map((k) => req.body[k]), req.user.id);
  audit(req.user.id, 'profile.updated', 'patient_profiles', req.user.id, { fields: keys });
  res.json({ profile: patientSummary(req.user.id).patient });
}));

// ---- Tracker links ----
const linkRow = (l) => ({
  ...l,
  patient: db.prepare('SELECT id,name,email,avatar_seed FROM users WHERE id=?').get(l.patient_id),
  tracker: db.prepare('SELECT id,name,email,avatar_seed FROM users WHERE id=?').get(l.tracker_id),
});

linksRouter.get('/', requireAuth, wrap((req, res) => {
  const col = req.user.role === 'patient' ? 'patient_id' : req.user.role === 'tracker' ? 'tracker_id' : null;
  if (!col) throw new HttpError(403, 'FORBIDDEN', 'Reviewers have no links.');
  res.json({ links: db.prepare(`SELECT * FROM tracker_links WHERE ${col}=? ORDER BY created_at DESC`).all(req.user.id).map(linkRow) });
}));

linksRouter.post('/invite', requireRole('patient'), validate(z.object({ email: z.string().trim().toLowerCase().email() })), wrap(async (req, res) => {
  const t = db.prepare("SELECT id,name FROM users WHERE email=? AND role='tracker'").get(req.body.email);
  if (!t) throw new HttpError(404, 'NO_TRACKER', 'No tracker account uses that email. Ask them to register as a Tracker first.');
  if (db.prepare('SELECT 1 FROM tracker_links WHERE patient_id=? AND tracker_id=?').get(req.user.id, t.id)) throw new HttpError(409, 'EXISTS', 'Already invited or linked.');
  const { clock } = await import('../services/clock.js');
  const { notify } = await import('../services/alerts.js');
  const info = db.prepare("INSERT INTO tracker_links(patient_id,tracker_id,status,created_at) VALUES(?,?, 'pending', ?)").run(req.user.id, t.id, clock.stamp());
  audit(req.user.id, 'link.invited', 'tracker_links', info.lastInsertRowid, { tracker: t.name });
  notify([t.id], req.user.id, 'invite', `${req.user.name} invited you to follow their medicines. Open Links to accept.`);
  res.status(201).json({ link: linkRow(db.prepare('SELECT * FROM tracker_links WHERE id=?').get(info.lastInsertRowid)) });
}));

linksRouter.post('/accept', requireRole('tracker'), validate(z.object({ linkId: z.number().int() })), wrap((req, res) => {
  const l = db.prepare("SELECT * FROM tracker_links WHERE id=? AND tracker_id=? AND status='pending'").get(req.body.linkId, req.user.id);
  if (!l) throw new HttpError(404, 'NOT_FOUND', 'Invitation not found.');
  db.prepare("UPDATE tracker_links SET status='active' WHERE id=?").run(l.id);
  audit(req.user.id, 'link.accepted', 'tracker_links', l.id, {});
  res.json({ link: linkRow(db.prepare('SELECT * FROM tracker_links WHERE id=?').get(l.id)) });
}));

linksRouter.delete('/:id', requireAuth, wrap((req, res) => {
  const l = db.prepare('SELECT * FROM tracker_links WHERE id=?').get(Number(req.params.id));
  if (!l || (l.patient_id !== req.user.id && l.tracker_id !== req.user.id)) throw new HttpError(404, 'NOT_FOUND', 'Link not found.');
  db.prepare('DELETE FROM tracker_links WHERE id=?').run(l.id);
  audit(req.user.id, 'link.removed', 'tracker_links', l.id, {});
  res.json({ ok: true });
}));
