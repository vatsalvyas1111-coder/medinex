import { db } from '../db/index.js';
import { clock, addDays, minutesBetween } from './clock.js';
import { GRACE_MIN, slotOf, streakInfo, dosesPerDay, daysLeft } from './doses.js';

/** Analytics for one patient over the last `range` days (inclusive of today). */
export function adherenceStats(patientId, range = 30) {
  const today = clock.today();
  const from = addDays(today, -(range - 1));
  const rows = db.prepare(`
    SELECT d.id, d.medicine_id, d.scheduled_for, d.status, d.taken_at, d.note, m.name, m.color
    FROM dose_logs d JOIN medicines m ON m.id = d.medicine_id
    WHERE d.patient_id=? AND d.scheduled_for >= ? AND d.scheduled_for < ?
    ORDER BY d.scheduled_for`).all(patientId, from, addDays(today, 1));

  const counted = rows.filter((r) => r.status !== 'pending');
  const taken = counted.filter((r) => r.status === 'taken');
  const onTime = taken.filter((r) => minutesBetween(r.scheduled_for, r.taken_at) <= GRACE_MIN);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

  const byMed = new Map();
  const bySlot = { morning: { due: 0, missed: 0 }, afternoon: { due: 0, missed: 0 }, evening: { due: 0, missed: 0 }, night: { due: 0, missed: 0 } };
  const byDay = new Map();
  for (const r of counted) {
    const m = byMed.get(r.medicine_id) || { medicineId: r.medicine_id, name: r.name, color: r.color, due: 0, taken: 0 };
    m.due++; if (r.status === 'taken') m.taken++;
    byMed.set(r.medicine_id, m);
    const slot = bySlot[slotOf(r.scheduled_for.slice(11, 16))];
    slot.due++; if (r.status === 'missed') slot.missed++;
  }
  for (const r of rows) {
    const day = r.scheduled_for.slice(0, 10);
    const e = byDay.get(day) || { date: day, total: 0, taken: 0, late: 0, missed: 0, pending: 0 };
    e.total++;
    if (r.status === 'taken') { e.taken++; if (minutesBetween(r.scheduled_for, r.taken_at) > GRACE_MIN) e.late++; }
    else if (r.status === 'missed' || r.status === 'skipped') e.missed++;
    else e.pending++;
    byDay.set(day, e);
  }
  const heatmap = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const e = byDay.get(date) || { date, total: 0, taken: 0, late: 0, missed: 0, pending: 0 };
    const closed = e.total - e.pending;
    let level = 'none';
    if (e.total > 0) {
      if (closed === 0) level = 'pending';
      else if (e.missed / closed >= 0.34) level = 'red';
      else if (e.missed > 0 || e.late > 0) level = 'amber';
      else level = 'green';
    }
    heatmap.push({ ...e, level });
  }
  const worst = Object.entries(bySlot).filter(([, v]) => v.missed > 0).sort((a, b) => b[1].missed - a[1].missed)[0];
  const notes = rows.filter((r) => r.note).slice(-5).map((r) => ({ date: r.scheduled_for, medicine: r.name, note: r.note }));

  return {
    range,
    adherence: pct(taken.length, counted.length),
    onTime: pct(onTime.length, taken.length),
    taken: taken.length, missed: counted.filter((r) => r.status === 'missed').length, total: counted.length,
    streak: streakInfo(patientId),
    byMedicine: [...byMed.values()].map((m) => ({ ...m, adherence: pct(m.taken, m.due) })),
    byTimeSlot: Object.entries(bySlot).map(([slot, v]) => ({ slot, ...v, missRate: pct(v.missed, v.due) ?? 0 })),
    worstSlot: worst ? worst[0] : null,
    heatmap,
    notes,
    forecast: stockForecast(patientId),
  };
}

export function stockForecast(patientId) {
  return db.prepare("SELECT id,name,color,stock_count,refill_threshold FROM medicines WHERE patient_id=? AND status='active'").all(patientId)
    .map((m) => ({ ...m, dosesPerDay: Number(dosesPerDay(m.id).toFixed(2)), daysLeft: daysLeft(m.id), low: m.stock_count <= m.refill_threshold }));
}
