import { db } from '../db/index.js';
import { clock, addDays, parseStamp } from './clock.js';
import { dosesForDay, streakInfo } from './doses.js';
import { adherenceStats } from './stats.js';
import { linkedPatientIds } from './access.js';
import { interactionFlags, allergyFlags, worstSeverity } from './interactions.js';

export function ageOf(dob) {
  if (!dob) return null;
  const t = clock.now(); const b = new Date(dob);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

export function medicinesWithSchedules(patientId, includeInactive = false) {
  const meds = db.prepare(`SELECT * FROM medicines WHERE patient_id=? ${includeInactive ? '' : "AND status='active'"} ORDER BY id`).all(patientId);
  const sched = db.prepare("SELECT id,time_of_day,days_mask FROM schedules WHERE medicine_id=? AND days_mask <> '-------' ORDER BY time_of_day");
  return meds.map((m) => ({ ...m, schedules: sched.all(m.id) }));
}

export function patientBasics(patientId) {
  const u = db.prepare('SELECT id,name,email,avatar_seed FROM users WHERE id=? AND role=?').get(patientId, 'patient');
  if (!u) return null;
  const p = db.prepare('SELECT * FROM patient_profiles WHERE user_id=?').get(patientId) || {};
  return { ...u, dob: p.dob, age: ageOf(p.dob), allergies: p.allergies || '', conditions: p.conditions || '', emergency_contact: p.emergency_contact || '', phone: p.phone || '' };
}

export function statusLabel(today) {
  const missed = today.filter((d) => d.status === 'missed').length;
  const overdue = today.filter((d) => d.state === 'overdue').length;
  if (missed >= 2) return { key: 'attention', label: 'Needs attention' };
  if (missed === 1) return { key: 'missed', label: '1 missed' };
  if (overdue > 0) return { key: 'overdue', label: `${overdue} overdue` };
  return { key: 'ok', label: 'On track' };
}

/** Rich per-patient snapshot for tracker dashboard / detail. */
export function patientSummary(patientId) {
  const basics = patientBasics(patientId);
  if (!basics) return null;
  const today = dosesForDay(patientId, clock.today());
  const taken = today.filter((d) => d.status === 'taken');
  const lastTaken = taken.map((d) => d.taken_at).sort().pop() || db.prepare("SELECT MAX(taken_at) t FROM dose_logs WHERE patient_id=? AND status='taken'").get(patientId)?.t || null;
  const s7 = adherenceStats(patientId, 7);
  const s30 = adherenceStats(patientId, 30);
  return {
    patient: basics,
    medicines: medicinesWithSchedules(patientId),
    today,
    progress: { taken: taken.length, total: today.length },
    lastTaken,
    status: statusLabel(today),
    streak: streakInfo(patientId),
    adherence7: s7.adherence, adherence30: s30.adherence,
    stock: s30.forecast,
    stats: s30,
    pendingRequests: db.prepare("SELECT id,name,dosage,reason,created_at FROM medicine_requests WHERE patient_id=? AND status='pending'").all(patientId),
  };
}

/** Compact per-patient object for the AI snapshot. */
function compactPatient(patientId) {
  const b = patientBasics(patientId);
  const meds = medicinesWithSchedules(patientId);
  const today = dosesForDay(patientId, clock.today());
  const s14 = adherenceStats(patientId, 14);
  const s7 = adherenceStats(patientId, 7);
  return {
    patient_id: patientId,
    profile: { name: b.name, age: b.age, conditions: b.conditions, allergies: b.allergies },
    active_medicines: meds.map((m) => ({
      name: m.name, dosage: m.dosage, form: m.form, instructions: m.instructions,
      schedule: m.schedules.map((s) => `${s.time_of_day} (${s.days_mask === 'MTWTFSS' ? 'daily' : s.days_mask})`),
      stock_left: m.stock_count, refill_at: m.refill_threshold,
    })),
    today_doses: today.map((d) => ({ medicine: d.name, dosage: d.dosage, time: d.time, status: d.state, taken_at: d.taken_at?.slice(11, 16) ?? null, note: d.note })),
    adherence_14d_percent: s14.adherence,
    adherence_7d_percent: s7.adherence,
    adherence_by_medicine_14d: s14.byMedicine.map((m) => ({ medicine: m.name, percent: m.adherence })),
    most_missed_time_of_day_14d: s14.worstSlot,
    missed_by_time_of_day_14d: s14.byTimeSlot.map((s) => ({ slot: s.slot, missed: s.missed, of: s.due })),
    missed_last_7d: s7.missed,
    streak_days: streakInfo(patientId).current,
    low_stock: s14.forecast.filter((f) => f.low).map((f) => ({ medicine: f.name, left: f.stock_count, days_left: f.daysLeft })),
    recent_dose_notes: s14.notes,
    pending_requests: db.prepare("SELECT name,dosage,reason FROM medicine_requests WHERE patient_id=? AND status='pending'").all(patientId),
  };
}

export function requestContext(reqRow) {
  const b = patientBasics(reqRow.patient_id);
  const meds = medicinesWithSchedules(reqRow.patient_id).map((m) => m.name);
  const inter = interactionFlags(reqRow.name, meds);
  const alg = allergyFlags(reqRow.name, b.allergies);
  return {
    request_id: reqRow.id, requested_medicine: reqRow.name, dosage: reqRow.dosage || 'not specified', reason: reqRow.reason || 'not given',
    submitted: reqRow.created_at,
    patient: { name: b.name, age: b.age, conditions: b.conditions, allergies: b.allergies },
    current_medicines: medicinesWithSchedules(reqRow.patient_id).map((m) => `${m.name} ${m.dosage}`),
    interaction_flags: inter.map((f) => ({ with: f.with, severity: f.severity, note: f.note })),
    allergy_flags: alg.map((a) => a.note),
    overall_flag: worstSeverity(inter),
  };
}

/** Role-scoped AI snapshot. The model never receives data the user could not see in the UI. */
export function buildContext(user) {
  if (user.role === 'patient') return { role: 'patient', ...compactPatient(user.id) };
  if (user.role === 'tracker') return { role: 'tracker', linked_patients: linkedPatientIds(user.id).map(compactPatient) };
  const pending = db.prepare("SELECT * FROM medicine_requests WHERE status='pending' ORDER BY created_at").all();
  return { role: 'reviewer', pending_requests: pending.map(requestContext) };
}
