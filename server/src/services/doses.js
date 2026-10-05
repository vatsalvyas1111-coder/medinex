import { db } from '../db/index.js';
import { clock, dateStr, addDays, parseStamp, weekdayIndex, minutesBetween } from './clock.js';
import { audit } from './audit.js';
import { emit, emitMany } from './events.js';
import { notify } from './alerts.js';
import { activeTrackerIds } from './access.js';

export const GRACE_MIN = 30;         // overdue (amber) after this
export const MISSED_AFTER_MIN = 120; // cron flips to missed after this

const DAY_LETTERS = 'MTWTFSS';

/** Idempotently create 'pending' rows for a patient's schedules on one day. */
export function ensureDosesForDay(patientId, day) {
  const rows = db.prepare(`
    SELECT s.id schedule_id, s.time_of_day, s.days_mask, m.id medicine_id, m.start_date, m.end_date, m.created_at
    FROM schedules s JOIN medicines m ON m.id = s.medicine_id
    WHERE m.patient_id = ? AND m.status = 'active'`).all(patientId);
  const ins = db.prepare(`INSERT OR IGNORE INTO dose_logs(medicine_id,schedule_id,patient_id,scheduled_for,status)
                          VALUES(?,?,?,?, 'pending')`);
  const wd = weekdayIndex(day);
  let created = 0;
  for (const r of rows) {
    if (r.days_mask[wd] !== DAY_LETTERS[wd]) continue;
    if (r.start_date > day) continue;
    if (r.end_date && r.end_date < day) continue;
    if (`${day}T${r.time_of_day}` < r.created_at && day === r.created_at.slice(0, 10)) continue; // no retroactive doses on the day a medicine is added
    created += ins.run(r.medicine_id, r.schedule_id, patientId, `${day}T${r.time_of_day}`, ).changes;
  }
  return created;
}

export function ensureDosesAllPatients(days = 2) {
  const patients = db.prepare("SELECT id FROM users WHERE role='patient'").all();
  const today = clock.today();
  let n = 0;
  for (const p of patients) for (let i = days - 1; i >= 0; i--) n += ensureDosesForDay(p.id, addDays(today, -i));
  return n;
}

export const slotOf = (time) => {
  const h = Number(time.slice(0, 2));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
};

/** Decorate a raw dose row with derived UI state relative to the demo clock. */
export function decorate(row, nowStamp = clock.stamp()) {
  const minsPast = minutesBetween(row.scheduled_for, nowStamp);
  let state = row.status;
  if (row.status === 'pending') state = minsPast > GRACE_MIN ? 'overdue' : minsPast >= -60 ? 'due' : 'upcoming';
  const time = row.scheduled_for.slice(11, 16);
  const late = row.status === 'taken' && row.taken_at ? minutesBetween(row.scheduled_for, row.taken_at) > GRACE_MIN : false;
  return { ...row, time, slot: slotOf(time), state, late, minutes_past: Math.round(minsPast) };
}

const DOSE_SELECT = `
  SELECT d.*, m.name, m.dosage, m.form, m.color, m.instructions, m.stock_count, m.refill_threshold
  FROM dose_logs d JOIN medicines m ON m.id = d.medicine_id`;

export function dosesForDay(patientId, day) {
  ensureDosesForDay(patientId, day);
  const now = clock.stamp();
  return db.prepare(`${DOSE_SELECT} WHERE d.patient_id=? AND d.scheduled_for LIKE ? ORDER BY d.scheduled_for, m.name`)
    .all(patientId, `${day}%`).map((r) => decorate(r, now));
}

export function getDose(id) { return db.prepare(`${DOSE_SELECT} WHERE d.id=?`).get(id); }

export function streakInfo(patientId) {
  const today = clock.today();
  const rows = db.prepare(`SELECT substr(scheduled_for,1,10) day, status FROM dose_logs
    WHERE patient_id=? AND scheduled_for >= ? AND scheduled_for < ? ORDER BY scheduled_for`)
    .all(patientId, `${addDays(today, -120)}`, `${addDays(today, 1)}`);
  const byDay = new Map();
  for (const r of rows) {
    const e = byDay.get(r.day) || { total: 0, taken: 0, open: 0 };
    e.total++; if (r.status === 'taken') e.taken++; if (r.status === 'pending') e.open++;
    byDay.set(r.day, e);
  }
  const days = [...byDay.keys()].sort();
  let longest = 0, run = 0;
  for (const d of days) {
    const e = byDay.get(d);
    if (e.taken === e.total) { run++; longest = Math.max(longest, run); }
    else if (d === today && e.open > 0 && e.taken + e.open === e.total) { /* today still in progress: neither extends nor breaks */ }
    else run = 0;
  }
  // current streak: walk back from today
  let current = 0;
  for (let i = 0; i < 120; i++) {
    const d = addDays(today, -i);
    const e = byDay.get(d);
    if (!e) { if (i === 0) continue; else continue; }
    if (e.taken === e.total) current++;
    else if (i === 0 && e.open > 0) continue; // today not finished yet
    else break;
  }
  return { current, longest: Math.max(longest, current) };
}

function trackerAudience(patientId) { return [patientId, ...activeTrackerIds(patientId)]; }
const patientName = (id) => db.prepare('SELECT name FROM users WHERE id=?').get(id)?.name ?? 'Patient';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function takeDose(user, doseId, { note } = {}) {
  const dose = getDose(doseId);
  if (!dose || dose.patient_id !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Dose not found');
  if (dose.scheduled_for.slice(0, 10) !== clock.today()) throw new HttpError(409, 'NOT_TODAY', 'Only today\'s doses can be logged');
  if (dose.status === 'taken') throw new HttpError(409, 'ALREADY_TAKEN', 'This dose is already logged');
  const takenAt = clock.stamp();
  let lowStock = false;
  db.transaction(() => {
    db.prepare("UPDATE dose_logs SET status='taken', taken_at=?, note=COALESCE(?,note) WHERE id=?").run(takenAt, note ?? null, doseId);
    const before = dose.stock_count;
    db.prepare('UPDATE medicines SET stock_count = MAX(stock_count-1,0) WHERE id=?').run(dose.medicine_id);
    lowStock = before > dose.refill_threshold && Math.max(before - 1, 0) <= dose.refill_threshold;
    audit(user.id, 'dose.taken', 'dose_logs', doseId, { medicine: dose.name, scheduled_for: dose.scheduled_for, taken_at: takenAt });
  })();
  const fresh = decorate(getDose(doseId));
  const all = dosesForDay(user.id, clock.today());
  const done = all.every((d) => d.status === 'taken');
  const payload = { patientId: user.id, patientName: user.name, doseId, status: 'taken', medicine: dose.name, late: fresh.late, allDone: done };
  emitMany(trackerAudience(user.id), 'dose', payload);

  if (lowStock) {
    const days = daysLeft(dose.medicine_id);
    notify(trackerAudience(user.id), user.id, 'low_stock',
      `${dose.name} is running low for ${user.name}: ${Math.max(dose.stock_count - 1, 0)} left${days != null ? ` (about ${days} days)` : ''}.`);
  }
  let streak = streakInfo(user.id);
  if (done && [3, 7, 14, 30, 60, 90].includes(streak.current)) {
    notify(activeTrackerIds(user.id).concat(user.id), user.id, 'streak', `${user.name} reached a ${streak.current}-day perfect streak!`);
  }
  return { dose: fresh, allDone: done, streak };
}

export function undoDose(user, doseId) {
  const dose = getDose(doseId);
  if (!dose || dose.patient_id !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Dose not found');
  if (dose.status !== 'taken') throw new HttpError(409, 'NOT_TAKEN', 'This dose is not marked taken');
  if (dose.scheduled_for.slice(0, 10) !== clock.today()) throw new HttpError(409, 'NOT_TODAY', 'Undo is only available on the same day');
  db.transaction(() => {
    db.prepare("UPDATE dose_logs SET status='pending', taken_at=NULL WHERE id=?").run(doseId);
    db.prepare('UPDATE medicines SET stock_count = stock_count+1 WHERE id=?').run(dose.medicine_id);
    audit(user.id, 'dose.undone', 'dose_logs', doseId, { medicine: dose.name });
  })();
  emitMany(trackerAudience(user.id), 'dose', { patientId: user.id, patientName: user.name, doseId, status: 'pending', medicine: dose.name });
  return { dose: decorate(getDose(doseId)) };
}

export function setDoseNote(user, doseId, note) {
  const dose = getDose(doseId);
  if (!dose || dose.patient_id !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Dose not found');
  db.prepare('UPDATE dose_logs SET note=? WHERE id=?').run(note || null, doseId);
  audit(user.id, 'dose.note', 'dose_logs', doseId, { note });
  if (note) {
    const trackers = activeTrackerIds(user.id);
    notify(trackers, user.id, 'note', `${user.name} added a note on ${dose.name}: "${note}"`);
  }
  emitMany(trackerAudience(user.id), 'dose', { patientId: user.id, doseId, status: dose.status, medicine: dose.name });
  return decorate(getDose(doseId));
}

/** Doses per day for a medicine, used for refill forecasting. */
export function dosesPerDay(medicineId) {
  const scheds = db.prepare('SELECT days_mask FROM schedules WHERE medicine_id=?').all(medicineId);
  return scheds.reduce((sum, s) => sum + [...s.days_mask].filter((c, i) => c === DAY_LETTERS[i]).length / 7, 0);
}
export function daysLeft(medicineId) {
  const m = db.prepare('SELECT stock_count FROM medicines WHERE id=?').get(medicineId);
  const dpd = dosesPerDay(medicineId);
  return m && dpd > 0 ? Math.floor(m.stock_count / dpd) : null;
}

/** Cron job: flip overdue pending doses to 'missed' and alert trackers. Returns count. */
export function runDoseCheck() {
  ensureDosesAllPatients(2);
  const now = clock.now();
  const cutoff = clock.stamp(new Date(now.getTime() - MISSED_AFTER_MIN * 60000));
  const due = db.prepare(`${DOSE_SELECT} WHERE d.status='pending' AND d.scheduled_for <= ?`).all(cutoff);
  for (const d of due) markMissed(d);
  return due.length;
}

export function markMissed(d) {
  db.prepare("UPDATE dose_logs SET status='missed' WHERE id=? AND status='pending'").run(d.id);
  audit(null, 'dose.missed', 'dose_logs', d.id, { medicine: d.name, scheduled_for: d.scheduled_for });
  const name = patientName(d.patient_id);
  const t = d.scheduled_for.slice(11, 16);
  notify(activeTrackerIds(d.patient_id), d.patient_id, 'missed_dose', `${name} missed ${d.name} ${d.dosage} (${t}).`);
  emitMany([d.patient_id, ...activeTrackerIds(d.patient_id)], 'dose', { patientId: d.patient_id, patientName: name, doseId: d.id, status: 'missed', medicine: d.name });
}
