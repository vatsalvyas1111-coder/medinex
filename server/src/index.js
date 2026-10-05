import { config } from './config.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db/index.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler } from './middleware/validate.js';
import { trace } from './middleware/trace.js';
import { authRouter } from './routes/auth.js';
import { medicinesRouter } from './routes/medicines.js';
import { dosesRouter } from './routes/doses.js';
import { requestsRouter } from './routes/requests.js';
import { trackersRouter, patientsRouter, linksRouter } from './routes/patients.js';
import { analyticsRouter, alertsRouter, auditRouter, eventsRouter } from './routes/misc.js';
import { aiRouter } from './routes/ai.js';
import { demoRouter } from './routes/demo.js';
import { startDoseCheck } from './jobs/doseCheck.js';
import { seedDatabase } from './db/seed.js';
import { groqEnabled } from './ai/groq.js';

// First run convenience: seed automatically if the database is empty.
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) { console.log('[boot] empty database — seeding demo data'); seedDatabase(); }

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(loadUser);
app.use(trace);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/medicines', medicinesRouter);
app.use('/api/doses', dosesRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/trackers', trackersRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/links', linksRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/events', eventsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/demo', demoRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }));

// Serve the built client when present (npm start). In dev, Vite serves the UI and proxies /api here.
if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}
app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`▲ Medinex API on http://localhost:${config.port}  (tz ${process.env.TZ}, demo=${config.demoMode}, AI=${groqEnabled() ? 'Groq' : 'local fallback (no GROQ_API_KEY)'})`);
  startDoseCheck();
});
