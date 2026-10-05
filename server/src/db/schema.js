export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient','tracker','reviewer')),
  avatar_seed TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dob TEXT,
  allergies TEXT DEFAULT '',
  conditions TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  phone TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tracker_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','active')),
  created_at TEXT NOT NULL,
  UNIQUE(patient_id, tracker_id)
);

CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  form TEXT NOT NULL CHECK (form IN ('tablet','capsule','syrup','injection','drops')),
  color TEXT NOT NULL DEFAULT '#2dd4bf',
  instructions TEXT DEFAULT '',
  stock_count INTEGER NOT NULL DEFAULT 0,
  refill_threshold INTEGER NOT NULL DEFAULT 5,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  time_of_day TEXT NOT NULL,
  days_mask TEXT NOT NULL DEFAULT 'MTWTFSS'
);

CREATE TABLE IF NOT EXISTS dose_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken','missed','skipped','pending')),
  taken_at TEXT,
  note TEXT,
  UNIQUE(schedule_id, scheduled_for)
);

CREATE TABLE IF NOT EXISTS medicine_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id INTEGER REFERENCES users(id),
  reviewer_note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

-- "tracker_id" is the alert RECIPIENT (tracker, patient or reviewer).
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS interaction_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_a TEXT NOT NULL,
  drug_b TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor','moderate','major')),
  note TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dose_patient_time ON dose_logs(patient_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_dose_status_time ON dose_logs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_med_patient ON medicines(patient_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipient ON alerts(tracker_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_req_status ON medicine_requests(status);
`;
