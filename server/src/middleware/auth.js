import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { config } from '../config.js';

export const COOKIE = 'medinex_token';

export function signIn(res, user) {
  const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5, secure: false });
}

export function publicUser(u) {
  return u && { id: u.id, name: u.name, email: u.email, role: u.role, avatar_seed: u.avatar_seed };
}

export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { uid } = jwt.verify(token, config.jwtSecret);
      req.user = db.prepare('SELECT id,name,email,role,avatar_seed FROM users WHERE id=?').get(uid) || null;
    } catch { req.user = null; }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
  next();
}

/** requireRole('patient') / requireRole('tracker','reviewer') — enforced on the server for every protected route. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: `This action is not available to the ${req.user.role} role.` } });
  }
  next();
};
