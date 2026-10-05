import { db } from '../db/index.js';
import { clock } from './clock.js';
import { emit } from './events.js';

/** Create an alert per recipient and push it over SSE. */
export function notify(recipientIds, patientId, type, message) {
  const ins = db.prepare('INSERT INTO alerts(tracker_id,patient_id,type,message,read,created_at) VALUES(?,?,?,?,0,?)');
  const created = [];
  for (const rid of new Set(recipientIds)) {
    const info = ins.run(rid, patientId, type, message, clock.stamp());
    const alert = db.prepare('SELECT * FROM alerts WHERE id=?').get(info.lastInsertRowid);
    emit(rid, 'alert', alert);
    created.push(alert);
  }
  return created;
}
