import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA);
// tiny forward-only migration for databases created before the `phone` column existed
if (!db.prepare("PRAGMA table_info(patient_profiles)").all().some((c) => c.name === 'phone')) db.exec("ALTER TABLE patient_profiles ADD COLUMN phone TEXT DEFAULT ''");

export const getSetting = (key, fallback = null) =>
  db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value ?? fallback;
export const setSetting = (key, value) =>
  db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, String(value));

/** Drop every row (used by demo reset / seed). Keeps the schema. */
export function wipeAll() {
  db.pragma('foreign_keys = OFF');
  for (const t of ['ai_messages','ai_conversations','audit_log','alerts','medicine_requests','dose_logs',
    'schedules','medicines','tracker_links','patient_profiles','users','interaction_rules','app_settings']) {
    db.exec(`DELETE FROM ${t}`);
  }
  db.exec("DELETE FROM sqlite_sequence");
  db.pragma('foreign_keys = ON');
}
