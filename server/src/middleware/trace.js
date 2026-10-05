// Powers the "Under the hood" panel: records the last API calls and which SQL table/row they touched.
export const traceLog = [];
const TABLE_BY_PREFIX = [
  [/^\/api\/doses/, 'dose_logs'], [/^\/api\/medicines/, 'medicines'], [/^\/api\/requests/, 'medicine_requests'],
  [/^\/api\/alerts/, 'alerts'], [/^\/api\/links/, 'tracker_links'], [/^\/api\/auth/, 'users'],
  [/^\/api\/ai/, 'ai_messages'], [/^\/api\/demo/, 'app_settings'], [/^\/api\/analytics/, 'dose_logs'], [/^\/api\/patients/, 'dose_logs'],
];

export function trace(req, res, next) {
  if (!req.path.startsWith('/api') || req.path === '/api/events' || req.path.startsWith('/api/demo/trace')) return next();
  const started = Date.now();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    const table = TABLE_BY_PREFIX.find(([re]) => re.test(path))?.[1] ?? '—';
    const idMatch = path.match(/\/(\d+)(?:\/|$)/);
    traceLog.unshift({
      at: new Date().toISOString(), method: req.method, path, status: res.statusCode, ms: Date.now() - started, table,
      rowId: idMatch ? Number(idMatch[1]) : null, write: req.method !== 'GET',
    });
    if (traceLog.length > 30) traceLog.pop();
  });
  next();
}
