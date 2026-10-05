// The model picks a card TYPE; the server fills in real numbers so cards can never contain invented data.
import { db } from '../db/index.js';
import { clock } from '../services/clock.js';
import { dosesForDay } from '../services/doses.js';
import { adherenceStats } from '../services/stats.js';
import { linkedPatientIds } from '../services/access.js';
import { patientBasics, requestContext } from '../services/summary.js';

function pickPatient(user, hint) {
  if (user.role === 'patient') return user.id;
  if (user.role !== 'tracker') return null;
  const ids = linkedPatientIds(user.id);
  if (hint?.patient_id && ids.includes(Number(hint.patient_id))) return Number(hint.patient_id);
  return ids[0] ?? null;
}

export function buildCard(user, raw) {
  let spec;
  try { spec = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  const type = spec?.type;
  const hint = spec?.data ?? {};
  if (type === 'request_summary') {
    if (user.role !== 'reviewer') return null;
    const r = db.prepare("SELECT * FROM medicine_requests WHERE id=? AND status='pending'").get(Number(hint.request_id))
      ?? db.prepare("SELECT * FROM medicine_requests WHERE status='pending' ORDER BY created_at LIMIT 1").get();
    if (!r) return null;
    const c = requestContext(r);
    return { type, data: { requestId: r.id, patient: c.patient.name, medicine: `${r.name} ${r.dosage}`.trim(), reason: c.reason,
      currentCount: c.current_medicines.length, flags: c.interaction_flags, allergyFlags: c.allergy_flags, overall: c.overall_flag } };
  }
  const pid = pickPatient(user, hint);
  if (!pid) return null;
  const name = patientBasics(pid)?.name;
  if (type === 'dose_summary') {
    const doses = dosesForDay(pid, clock.today());
    return { type, data: { patient: name, taken: doses.filter((d) => d.status === 'taken').length, total: doses.length,
      doses: doses.map((d) => ({ id: d.id, name: d.name, dosage: d.dosage, time: d.time, state: d.state, color: d.color, form: d.form })) } };
  }
  if (type === 'adherence') {
    const s = adherenceStats(pid, 14);
    return { type, data: { patient: name, adherence: s.adherence, onTime: s.onTime, streak: s.streak.current, worstSlot: s.worstSlot,
      days: s.heatmap.map((h) => ({ date: h.date, level: h.level })) } };
  }
  if (type === 'refill') {
    return { type, data: { patient: name, items: adherenceStats(pid, 7).forecast.map((f) => ({ name: f.name, color: f.color, left: f.stock_count, daysLeft: f.daysLeft, low: f.low })) } };
  }
  return null;
}
