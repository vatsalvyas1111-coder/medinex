import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { signIn, publicUser, requireAuth, COOKIE } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { clock } from '../services/clock.js';
import { audit } from '../services/audit.js';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 60_000, max: 15, keyPrefix: 'auth', message: 'Too many sign-in attempts. Try again in a minute.' });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  role: z.enum(['patient', 'tracker', 'reviewer']),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

authRouter.post('/register', limiter, validate(registerSchema), wrap(async (req, res) => {
  const { name, email, password, role, dob } = req.body;
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) {
    return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'That email is already registered.' } });
  }
  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users(name,email,password_hash,role,avatar_seed,created_at) VALUES(?,?,?,?,?,?)')
    .run(name, email, hash, role, `${name}-${Date.now() % 9973}`, clock.stamp());
  if (role === 'patient') db.prepare('INSERT INTO patient_profiles(user_id,dob) VALUES(?,?)').run(info.lastInsertRowid, dob ?? null);
  audit(info.lastInsertRowid, 'auth.register', 'users', info.lastInsertRowid, { role });
  const user = db.prepare('SELECT id,name,email,role,avatar_seed FROM users WHERE id=?').get(info.lastInsertRowid);
  signIn(res, user);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post('/login', limiter, validate(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })),
  wrap(async (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(req.body.email);
    const ok = u && (await bcrypt.compare(req.body.password, u.password_hash));
    if (!ok) return res.status(401).json({ error: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' } });
    signIn(res, u);
    audit(u.id, 'auth.login', 'users', u.id, {});
    res.json({ user: publicUser(u) });
  }));

authRouter.post('/logout', (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not signed in.' } });
  res.json({ user: publicUser(req.user) });
});
