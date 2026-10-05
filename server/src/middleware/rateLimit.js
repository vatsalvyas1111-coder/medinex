// Tiny in-memory sliding-window rate limiter (per user id, else per IP).
export function rateLimit({ windowMs, max, keyPrefix = 'rl', message = 'Too many requests, slow down a little.' }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.user?.id ?? req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    }
    arr.push(now); hits.set(key, arr);
    next();
  };
}
