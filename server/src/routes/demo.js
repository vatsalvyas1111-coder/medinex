import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { signIn, publicUser } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { clock } from '../services/clock.js';
import { audit } from '../services/audit.js';
import { runDoseCheck, markMissed, HttpError, ensureDosesAllPatients, daysLeft } from '../services/doses.js';
import { linkedPatientIds, activeTrackerIds } from '../services/access.js';
import { broadcast, emitMany, connectedCount } from '../services/events.js';
import { notify } from '../services/alerts.js';
import { seedDatabase, DEMO_ACCOUNTS } from '../db/seed.js';
import { createRequest } from './requests.js';
import { traceLog } from '../middleware/trace.js';
import { groqEnabled } from '../ai/groq.js';

export const demoRouter = Router();

demoRouter.use((req, res, next) => {
  if (!config.demoMode) return res.status(404).json({ error: { code: 'DEMO_OFF', message: 'Demo mode is disabled.' } });
  next();
});

const accounts = () => Object.entries(DEMO_ACCOUNTS).map(([role, email]) => {
  const u = db.prepare('SELECT id,name,email,role,avatar_seed FROM users WHERE email=?').get(email);
  return u && { role, ...publicUser(u) };
}).filter(Boolean);

demoRouter.get('/state', (req, res) => res.json({
  demoMode: true, now: clock.stamp(), offsetMinutes: clock.offsetMinutes(), accounts: accounts(),
  ai: groqEnabled() ? 'groq' : 'local', password: 'demo1234', connected: connectedCount(),
}));

demoRouter.post('/switch-role', validate(z.object({ role: z.enum(['patient', 'tracker', 'reviewer']) })), wrap((req, res) => {
  const u = db.prepare('SELECT id,name,email,role,avatar_seed FROM users WHERE email=?').get(DEMO_ACCOUNTS[req.body.role]);
  if (!u) throw new HttpError(404, 'NOT_SEEDED', 'Demo accounts are missing. Run npm run seed.');
  signIn(res, u);
  audit(u.id, 'demo.switch-role', 'users', u.id, { role: u.role });
  res.json({ user: publicUser(u) });
}));

const demoPatientId = (user) => {
  if (user.role === 'patient') return user.id;
  if (user.role === 'tracker') return linkedPatientIds(user.id)[0];
  return db.prepare('SELECT id FROM users WHERE email=?').get(DEMO_ACCOUNTS.patient)?.id;
};

demoRouter.post('/time-travel', requireAuth, validate(z.object({ action: z.enum(['+1h', '+6h', 'nextday', 'reset']) })), wrap((req, res) => {
  const before = clock.stamp();
  if (req.body.action === '+1h') clock.addMinutes(60);
  else if (req.body.action === '+6h') clock.addMinutes(360);
  else if (req.body.action === 'nextday') clock.jumpToNextDay('06:30');
  else { if (config.seedClockStart === 'real') clock.setOffset(0); else clock.setToTodayAt(config.seedClockStart); }
  ensureDosesAllPatients(2);
  const flipped = runDoseCheck(); // immediately, so missed-dose alerts appear within seconds
  audit(req.user.id, 'demo.time-travel', 'app_settings', 0, { action: req.body.action, from: before, to: clock.stamp(), flipped });
  broadcast('clock', { now: clock.stamp(), flipped });
  res.json({ now: clock.stamp(), flipped, offsetMinutes: clock.offsetMinutes() });
}));

const REQUESTS = [
  { name: 'Cetirizine', dosage: '10 mg', reason: 'Itchy eyes and sneezing since the weather changed.' },
  { name: 'Paracetamol', dosage: '500 mg', reason: 'Body ache and mild fever since last night.' },
  { name: 'Dextromethorphan syrup', dosage: '10 ml', reason: 'Dry cough at night that keeps me awake.' },
];
let reqCursor = 0;

demoRouter.post('/scenario', requireAuth, validate(z.object({ name: z.enum(['missed', 'request', 'low_stock']) })), wrap((req, res) => {
  const pid = demoPatientId(req.user);
  if (!pid) throw new HttpError(404, 'NO_PATIENT', 'No patient available for this scenario.');
  const pname = db.prepare('SELECT name FROM users WHERE id=?').get(pid).name;
  if (req.body.name === 'missed') {
    ensureDosesAllPatients(1);
    const d = db.prepare(`SELECT d.*, m.name, m.dosage FROM dose_logs d JOIN medicines m ON m.id=d.medicine_id
      WHERE d.patient_id=? AND d.status='pending' AND d.scheduled_for LIKE ? ORDER BY d.scheduled_for LIMIT 1`).get(pid, `${clock.today()}%`);
    if (!d) throw new HttpError(409, 'NOTHING_PENDING', 'No pending dose left today. Try time travel to the next day.');
    markMissed(d);
    audit(req.user.id, 'demo.scenario', 'dose_logs', d.id, { scenario: 'missed' });
    return res.json({ message: `${d.name} for ${pname} marked missed.` });
  }
  if (req.body.name === 'request') {
    const r = REQUESTS[reqCursor++ % REQUESTS.length];
    const created = createRequest(pid, r);
    audit(req.user.id, 'demo.scenario', 'medicine_requests', created.id, { scenario: 'request' });
    return res.json({ message: `${pname} requested ${r.name}.` });
  }
  const m = db.prepare("SELECT * FROM medicines WHERE patient_id=? AND status='active' AND stock_count > refill_threshold ORDER BY id DESC LIMIT 1").get(pid)
    ?? db.prepare("SELECT * FROM medicines WHERE patient_id=? AND status='active' ORDER BY id LIMIT 1").get(pid);
  if (!m) throw new HttpError(409, 'NO_MEDICINE', 'No active medicine.');
  const low = Math.max(m.refill_threshold - 1, 1);
  db.prepare('UPDATE medicines SET stock_count=? WHERE id=?').run(low, m.id);
  const days = daysLeft(m.id);
  notify([pid, ...activeTrackerIds(pid)], pid, 'low_stock', `${m.name} is running low for ${pname}: ${low} left${days != null ? ` (about ${days} days)` : ''}.`);
  emitMany([pid, ...activeTrackerIds(pid)], 'medicine', { patientId: pid, medicineId: m.id, change: 'stock' });
  audit(req.user.id, 'demo.scenario', 'medicines', m.id, { scenario: 'low_stock', stock: low });
  res.json({ message: `${m.name} stock set to ${low}.` });
}));

demoRouter.post('/reset', wrap((req, res) => {
  seedDatabase();
  broadcast('reset', { now: clock.stamp() });
  res.json({ ok: true, now: clock.stamp() });
}));

demoRouter.get('/trace', requireAuth, (req, res) => {
  const tables = ['users', 'medicines', 'schedules', 'dose_logs', 'medicine_requests', 'alerts', 'audit_log', 'ai_messages'];
  res.json({
    calls: traceLog,
    counts: Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c])),
    lastDose: db.prepare("SELECT id,medicine_id,status,scheduled_for,taken_at FROM dose_logs WHERE status='taken' ORDER BY taken_at DESC LIMIT 1").get() ?? null,
    lastAudit: db.prepare('SELECT id,action,entity,entity_id,created_at FROM audit_log ORDER BY id DESC LIMIT 1').get() ?? null,
    dbFile: 'server/data/medinex.db',
  });
});
