import { db } from '../db/index.js';
import { clock } from './clock.js';

const insert = () => db.prepare('INSERT INTO audit_log(actor_id,action,entity,entity_id,meta_json,created_at) VALUES(?,?,?,?,?,?)');
export function audit(actorId, action, entity, entityId, meta = {}) {
  insert().run(actorId ?? null, action, entity, entityId ?? null, JSON.stringify(meta), clock.stamp());
}
