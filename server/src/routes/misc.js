import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { canViewPatient, linkedPatientIds } from '../services/access.js';
import { adherenceStats } from '../services/stats.js';
import { HttpError } from '../services/doses.js';
import { patientBasics } from '../services/summary.js';
import { addClient, heartbeat } from '../services/events.js';
import { clock } from '../services/clock.js';

export const analyticsRouter = Router();
export const alertsRouter = Router();
export const auditRouter = Router();
export const eventsRouter = Router();

analyticsRouter.get('/adherence', requireAuth, validate(z.object({ patientId: z.coerce.number().int().optional(), range: z.coerce.number().int().min(7).max(90).default(30) }), 'query'),
  wrap((req, res) => {
    if (req.user.role === 'reviewer') throw new HttpError(403, 'FORBIDDEN', 'Reviewers cannot view adherence analytics.');
    const patientId = req.query.patientId ?? req.user.id;
    if (!canViewPatient(req.user, patientId)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this patient.');
    res.json({ patient: patientBasics(patientId), stats: adherenceStats(patientId, req.query.range) });
  }));

analyticsRouter.get('/compare', requireRole('tracker'), wrap((req, res) => {
  const range = Math.min(Math.max(Number(req.query.range) || 30, 7), 90);
  res.json({ patients: linkedPatientIds(req.user.id).map((id) => ({ patient: patientBasics(id), stats: adherenceStats(id, range) })) });
}));

alertsRouter.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT a.*, u.name patient_name FROM alerts a JOIN users u ON u.id=a.patient_id
    WHERE a.tracker_id=? ${req.query.unread ? 'AND a.read=0' : ''} ORDER BY a.created_at DESC, a.id DESC LIMIT 100`).all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM alerts WHERE tracker_id=? AND read=0').get(req.user.id).c;
  res.json({ alerts: rows, unread });
});
alertsRouter.patch('/:id/read', requireAuth, wrap((req, res) => {
  const r = db.prepare('UPDATE alerts SET read=1 WHERE id=? AND tracker_id=?').run(Number(req.params.id), req.user.id);
  if (!r.changes) throw new HttpError(404, 'NOT_FOUND', 'Alert not found');
  res.json({ ok: true });
}));
alertsRouter.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE alerts SET read=1 WHERE tracker_id=?').run(req.user.id);
  res.json({ ok: true });
});

auditRouter.get('/', requireRole('reviewer'), validate(z.object({
  action: z.string().optional(), entity: z.string().optional(), q: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100),
}), 'query'), (req, res) => {
  const { action, entity, q, limit } = req.query;
  const where = []; const args = [];
  if (action) { where.push('a.action LIKE ?'); args.push(`${action}%`); }
  if (entity) { where.push('a.entity = ?'); args.push(entity); }
  if (q) { where.push('(a.meta_json LIKE ? OR u.name LIKE ? OR a.action LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = db.prepare(`SELECT a.*, u.name actor_name, u.role actor_role FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).all(...args, limit);
  const facets = {
    actions: db.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all().map((r) => r.action),
    entities: db.prepare('SELECT DISTINCT entity FROM audit_log ORDER BY entity').all().map((r) => r.entity),
  };
  res.json({ entries: rows.map((r) => ({ ...r, meta: JSON.parse(r.meta_json || '{}') })), facets });
});

eventsRouter.get('/', requireAuth, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ now: clock.stamp() })}\n\n`);
  const remove = addClient(req.user.id, res);
  req.on('close', remove);
});
setInterval(heartbeat, 25_000).unref();
