import { ZodError } from 'zod';

export const validate = (schema, where = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[where]);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || where}: ${i.message}`).join('; ');
    return res.status(400).json({ error: { code: 'VALIDATION', message: msg } });
  }
  req[where] = parsed.data;
  next();
};

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION', message: err.message } });
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: { code: err.code || 'INTERNAL', message: status >= 500 ? 'Something went wrong on our side.' : err.message } });
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
