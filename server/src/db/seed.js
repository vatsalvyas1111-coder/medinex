// Seeds a complete, believable demo: `npm run seed`
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { db, wipeAll, setSetting } from './index.js';
import { clock, addDays, dateStr } from '../services/clock.js';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ACCOUNTS = {
  patient: 'ramesh@medinex.demo',
  tracker: 'vatsal@medinex.demo',
  reviewer: 'meera@medinex.demo',
};

function rng(seed) { // mulberry32: deterministic so the demo history is identical every run
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pad = (n) => String(n).padStart(2, '0');

export function seedDatabase() {
  wipeAll();
  clock.invalidate();
  if (config.seedClockStart === 'real') clock.setOffset(0); else clock.setToTodayAt(config.seedClockStart);
  setSetting('demo_mode', config.demoMode ? '1' : '0');
  const today = clock.today();
  const nowStamp = clock.stamp();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const day = (n) => addDays(today, n);

  const tx = db.transaction(() => {
    const uIns = db.prepare('INSERT INTO users(name,email,password_hash,role,avatar_seed,created_at) VALUES(?,?,?,?,?,?)');
    const mk = (name, email, role, seed) => uIns.run(name, email, hash, role, seed, `${day(-45)}T09:00:00`).lastInsertRowid;
    const ramesh = mk('Ramesh Patel', DEMO_ACCOUNTS.patient, 'patient', 'ramesh-saffron');
    const vatsal = mk('Vatsal Vyas', DEMO_ACCOUNTS.tracker, 'tracker', 'vatsal-lagoon');
    const meera = mk('Dr. Meera Shah', DEMO_ACCOUNTS.reviewer, 'reviewer', 'meera-orchid');
    const sushila = mk('Sushila Patel', 'sushila@medinex.demo', 'patient', 'sushila-rose');

    const pIns = db.prepare('INSERT INTO patient_profiles(user_id,dob,allergies,conditions,emergency_contact,phone) VALUES(?,?,?,?,?,?)');
    pIns.run(ramesh, '1954-03-14', 'Penicillin, Sulfa drugs', 'Type 2 diabetes, Hypertension, High cholesterol', 'Vatsal Vyas (son) · +91 98765 43210', '+91 98250 11223');
    pIns.run(sushila, '1957-11-02', 'None known', 'Hypothyroidism, Osteopenia', 'Vatsal Vyas (son) · +91 98765 43210', '+91 98250 44556');

    const lIns = db.prepare("INSERT INTO tracker_links(patient_id,tracker_id,status,created_at) VALUES(?,?, 'active', ?)");
    lIns.run(ramesh, vatsal, `${day(-44)}T10:00:00`);
    lIns.run(sushila, vatsal, `${day(-44)}T10:05:00`);

    const rules = [
      ['aspirin', 'ibuprofen', 'moderate', 'Ibuprofen can blunt aspirin’s heart-protective effect and raise the risk of stomach bleeding.'],
      ['ibuprofen', 'amlodipine', 'moderate', 'NSAIDs like ibuprofen can weaken the blood-pressure lowering effect of amlodipine.'],
      ['ibuprofen', 'metformin', 'minor', 'NSAIDs can affect kidney function, which matters for how the body clears metformin.'],
      ['ibuprofen', 'lisinopril', 'moderate', 'NSAIDs can reduce the effect of ACE inhibitors and stress the kidneys.'],
      ['warfarin', 'aspirin', 'major', 'Taking these together significantly increases bleeding risk.'],
      ['warfarin', 'ibuprofen', 'major', 'NSAIDs greatly increase bleeding risk with warfarin.'],
      ['atorvastatin', 'clarithromycin', 'major', 'Clarithromycin can raise statin levels and the risk of muscle damage.'],
      ['amlodipine', 'simvastatin', 'moderate', 'Amlodipine can raise simvastatin levels; dose limits usually apply.'],
      ['levothyroxine', 'calcium', 'moderate', 'Calcium can reduce levothyroxine absorption. They are usually taken about 4 hours apart.'],
      ['losartan', 'potassium', 'moderate', 'Potassium supplements with losartan can raise blood potassium too high.'],
      ['sildenafil', 'nitroglycerin', 'major', 'This combination can cause a dangerous drop in blood pressure.'],
      ['pantoprazole', 'clopidogrel', 'moderate', 'Some acid reducers can lessen the effect of clopidogrel.'],
      ['metformin', 'alcohol', 'moderate', 'Alcohol with metformin increases the risk of lactic acidosis.'],
    ];
    const rIns = db.prepare('INSERT INTO interaction_rules(drug_a,drug_b,severity,note) VALUES(?,?,?,?)');
    for (const r of rules) rIns.run(...r);

    const mIns = db.prepare(`INSERT INTO medicines(patient_id,name,dosage,form,color,instructions,stock_count,refill_threshold,start_date,end_date,status,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,NULL,'active',?)`);
    const sIns = db.prepare('INSERT INTO schedules(medicine_id,time_of_day,days_mask) VALUES(?,?,?)');
    const addMed = (pid, name, dosage, form, color, instr, stock, thr, start, times, mask = 'MTWTFSS') => {
      const id = mIns.run(pid, name, dosage, form, color, instr, stock, thr, start, `${start}T08:00:00`).lastInsertRowid;
      const sids = times.map((t) => sIns.run(id, t, mask).lastInsertRowid);
      return { id, sids, times, name, patient: pid };
    };
    const meds = [
      addMed(ramesh, 'Metformin', '500 mg', 'tablet', '#7dd3fc', 'Take with food', 44, 10, day(-60), ['08:00', '20:00']),
      addMed(ramesh, 'Amlodipine', '5 mg', 'tablet', '#f472b6', 'Once daily, same time each morning', 26, 8, day(-60), ['08:00']),
      addMed(ramesh, 'Aspirin', '75 mg', 'tablet', '#fbbf24', 'After lunch', 19, 8, day(-60), ['14:00']),
      addMed(ramesh, 'Atorvastatin', '10 mg', 'tablet', '#818cf8', 'At bedtime', 13, 8, day(-60), ['21:00']),
      addMed(ramesh, 'Vitamin D3', '60000 IU', 'capsule', '#34d399', 'Once a week, with breakfast', 6, 2, day(-34), ['09:00'], '------S'),
      addMed(sushila, 'Levothyroxine', '50 mcg', 'tablet', '#a78bfa', 'Empty stomach, 30 minutes before breakfast', 31, 8, day(-60), ['06:30']),
      addMed(sushila, 'Telmisartan', '40 mg', 'tablet', '#fb7185', 'Once daily', 22, 8, day(-60), ['08:30']),
      addMed(sushila, 'Calcium + D3', '500 mg', 'tablet', '#fcd34d', 'After lunch', 40, 10, day(-60), ['14:30']),
    ];

    // ---- 30 days of realistic history ----
    const dIns = db.prepare('INSERT INTO dose_logs(medicine_id,schedule_id,patient_id,scheduled_for,status,taken_at,note) VALUES(?,?,?,?,?,?,?)');
    const rand = rng(20260929);
    for (const m of meds) {
      m.times.forEach((t, i) => {
        for (let back = 30; back >= 1; back--) {
          const d = day(-back);
          const wd = (new Date(`${d}T12:00:00`).getDay() + 6) % 7;
          const mask = m.name === 'Vitamin D3' ? '------S' : 'MTWTFSS';
          if (mask[wd] === '-') continue;
          if (m.name === 'Vitamin D3' && d < day(-34)) continue;
          const isRamesh = m.patient === ramesh;
          const evening = t >= '20:00';
          let missP = isRamesh ? (evening ? 0.30 : 0.05) : 0.06;
          let lateP = 0.12;
          let status = 'taken';
          let force = null;
          if (isRamesh && back <= 3) force = 'ontime';
          if (isRamesh && back === 4 && evening) force = 'miss';
          if (isRamesh && back === 5 && t === '20:00') force = 'miss';
          const r = rand();
          if (force === 'miss' || (!force && r < missP)) status = 'missed';
          else if (!force && rand() < 0.03) status = 'skipped';
          let takenAt = null; let note = null;
          if (status === 'taken') {
            const late = force !== 'ontime' && rand() < lateP;
            const delta = late ? 35 + Math.floor(rand() * 60) : Math.floor(rand() * 20) - 5;
            const [h, mi] = t.split(':').map(Number);
            const tot = h * 60 + mi + delta;
            takenAt = `${d}T${pad(Math.floor(tot / 60))}:${pad(tot % 60)}:00`;
            if (isRamesh && m.name === 'Amlodipine' && back === 6) note = 'Felt a little dizzy after this one';
          }
          dIns.run(m.id, m.sids[i], m.patient, `${d}T${t}`, status, takenAt, note);
        }
      });
    }

    // ---- requests ----
    const qIns = db.prepare(`INSERT INTO medicine_requests(patient_id,name,dosage,reason,status,reviewer_id,reviewer_note,created_at,decided_at) VALUES(?,?,?,?,?,?,?,?,?)`);
    const approved = qIns.run(ramesh, 'Vitamin D3', '60000 IU', 'My doctor said my bones need it. Vitamin D level was low in the last blood test.', 'approved', meera,
      'Weekly dose is appropriate. Take with breakfast.', `${day(-35)}T11:20:00`, `${day(-34)}T09:05:00`).lastInsertRowid;
    const r1 = qIns.run(ramesh, 'Ibuprofen', '400 mg', 'My knee hurts at night and I cannot sleep well. It has been like this for a week.', 'pending', null, null, `${day(-1)}T18:20:00`, null).lastInsertRowid;
    const r2 = qIns.run(ramesh, 'Pantoprazole', '40 mg', 'Burning feeling in my chest and throat in the mornings, mostly after tea.', 'pending', null, null, `${day(-1)}T21:10:00`, null).lastInsertRowid;

    // ---- alerts ----
    const aIns = db.prepare('INSERT INTO alerts(tracker_id,patient_id,type,message,read,created_at) VALUES(?,?,?,?,?,?)');
    aIns.run(vatsal, ramesh, 'missed_dose', 'Ramesh Patel missed Metformin 500 mg (20:00).', 0, `${day(-4)}T22:00:00`);
    aIns.run(vatsal, ramesh, 'missed_dose', 'Ramesh Patel missed Atorvastatin 10 mg (21:00).', 0, `${day(-4)}T23:00:00`);
    aIns.run(vatsal, ramesh, 'missed_dose', 'Ramesh Patel missed Metformin 500 mg (20:00).', 1, `${day(-5)}T22:00:00`);
    aIns.run(vatsal, ramesh, 'request_decided', 'Dr. Meera Shah approved Vitamin D3 for Ramesh Patel.', 1, `${day(-34)}T09:05:00`);
    aIns.run(ramesh, ramesh, 'streak', 'Nice! You have a 3-day perfect streak going.', 0, `${day(-1)}T22:30:00`);
    aIns.run(meera, ramesh, 'new_request', 'Ramesh Patel requested Ibuprofen 400 mg.', 0, `${day(-1)}T18:20:00`);
    aIns.run(meera, ramesh, 'new_request', 'Ramesh Patel requested Pantoprazole 40 mg.', 0, `${day(-1)}T21:10:00`);

    // ---- audit trail (historic) ----
    const auIns = db.prepare('INSERT INTO audit_log(actor_id,action,entity,entity_id,meta_json,created_at) VALUES(?,?,?,?,?,?)');
    auIns.run(ramesh, 'request.created', 'medicine_requests', approved, JSON.stringify({ name: 'Vitamin D3', dosage: '60000 IU' }), `${day(-35)}T11:20:00`);
    auIns.run(meera, 'request.approved', 'medicine_requests', approved, JSON.stringify({ medicine: 'Vitamin D3', note: 'Weekly dose is appropriate.' }), `${day(-34)}T09:05:00`);
    auIns.run(ramesh, 'medicine.created', 'medicines', meds[4].id, JSON.stringify({ name: 'Vitamin D3', via: 'request' }), `${day(-34)}T09:05:00`);
    auIns.run(vatsal, 'link.accepted', 'tracker_links', 1, '{}', `${day(-44)}T10:00:00`);
    auIns.run(ramesh, 'request.created', 'medicine_requests', r1, JSON.stringify({ name: 'Ibuprofen', dosage: '400 mg' }), `${day(-1)}T18:20:00`);
    auIns.run(ramesh, 'request.created', 'medicine_requests', r2, JSON.stringify({ name: 'Pantoprazole', dosage: '40 mg' }), `${day(-1)}T21:10:00`);
    auIns.run(null, 'dose.missed', 'dose_logs', 0, JSON.stringify({ medicine: 'Metformin', scheduled_for: `${day(-4)}T20:00` }), `${day(-4)}T22:00:00`);

    // ---- AI conversations ----
    const cIns = db.prepare('INSERT INTO ai_conversations(user_id,created_at) VALUES(?,?)');
    const msgIns = db.prepare('INSERT INTO ai_messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)');
    const convo = (uid, pairs) => {
      const cid = cIns.run(uid, `${day(-1)}T20:00:00`).lastInsertRowid;
      pairs.forEach(([role, content], i) => msgIns.run(cid, role, content, `${day(-1)}T20:${pad(i)}:00`));
    };
    convo(ramesh, [
      ['user', 'What time is my evening medicine?'],
      ['assistant', 'Your evening Metformin is at **8:00 PM** and Atorvastatin is at **9:00 PM**. Would you like a reminder to pair Metformin with dinner? 😊'],
    ]);
    convo(vatsal, [
      ['user', 'Which medicine does Papa miss the most?'],
      ['assistant', 'Over the last two weeks, the **evening Metformin (8 PM)** is missed most often. Evenings are the trickiest slot for Ramesh. It may help to talk with him about linking it to dinner.\n<card>{"type":"adherence","data":{}}</card>'],
    ]);
    convo(meera, [
      ['user', 'Summarise the pending requests.'],
      ['assistant', 'There are 2 pending requests, both from Ramesh Patel. **Ibuprofen 400 mg** has interaction flags with his current medicines; **Pantoprazole 40 mg** has none. The decision is yours.\n<card>{"type":"request_summary","data":{}}</card>'],
    ]);
  });
  tx();
  return { ids: 'seeded', today, nowStamp };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = seedDatabase();
  const c = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  console.log(`✔ Seeded Medinex (${config.dbPath})`);
  console.log(`  users=${c('users')} medicines=${c('medicines')} dose_logs=${c('dose_logs')} requests=${c('medicine_requests')} alerts=${c('alerts')}`);
  console.log(`  demo clock: ${clock.stamp()}   accounts: ${Object.values(DEMO_ACCOUNTS).join(', ')}  password: ${DEMO_PASSWORD}`);
  void out;
}
