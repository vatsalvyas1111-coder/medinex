// Server-Sent Events hub: one open response per connected browser tab, keyed by user id.
const clients = new Map(); // userId -> Set<res>

export function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
  return () => { clients.get(userId)?.delete(res); };
}
export function emit(userId, event, data = {}) {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}
export function emitMany(userIds, event, data) { for (const id of new Set(userIds)) emit(id, event, data); }
export function broadcast(event, data) { for (const id of clients.keys()) emit(id, event, data); }
export function heartbeat() { for (const set of clients.values()) for (const r of set) r.write(': ping\n\n'); }
export const connectedCount = () => [...clients.values()].reduce((n, s) => n + s.size, 0);
