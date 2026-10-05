import type {
  Role, User, Dose, TodayResponse, Medicine, PatientSummary,
  MedRequest, AlertItem, AuditEntry, LinkItem, Stats, PatientBasics, HeatDay
} from './types';

// Detect whether we are on a static deployment host (GitHub Pages, Vercel preview/static, or file)
export const isStaticHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    h.includes('github.io') ||
    h.includes('vercel.app') ||
    h.includes('netlify.app') ||
    h.includes('pages.dev') ||
    window.location.protocol === 'file:' ||
    localStorage.getItem('medinex_force_mock') === 'true'
  );
};

export const DEMO_ACCOUNTS: (User & { role: Role })[] = [
  { id: 1, name: 'Ramesh Patel', email: 'ramesh@medinex.demo', role: 'patient', avatar_seed: 'ramesh-saffron' },
  { id: 2, name: 'Vatsal Vyas', email: 'vatsal@medinex.demo', role: 'tracker', avatar_seed: 'vatsal-lagoon' },
  { id: 3, name: 'Dr. Meera Shah', email: 'meera@medinex.demo', role: 'reviewer', avatar_seed: 'meera-orchid' },
];

const PATIENT_RAMESH: PatientBasics = {
  id: 1,
  name: 'Ramesh Patel',
  email: 'ramesh@medinex.demo',
  avatar_seed: 'ramesh-saffron',
  dob: '1954-03-14',
  age: 72,
  allergies: 'Penicillin, Sulfa drugs',
  conditions: 'Type 2 diabetes, Hypertension, High cholesterol',
  emergency_contact: 'Vatsal Vyas (son) · +91 98765 43210',
  phone: '+91 98250 11223'
};

const PATIENT_SUSHILA: PatientBasics = {
  id: 4,
  name: 'Sushila Patel',
  email: 'sushila@medinex.demo',
  avatar_seed: 'sushila-rose',
  dob: '1957-11-02',
  age: 69,
  allergies: 'None known',
  conditions: 'Hypothyroidism, Osteopenia',
  emergency_contact: 'Vatsal Vyas (son) · +91 98765 43210',
  phone: '+91 98250 44556'
};

const pad = (n: number) => String(n).padStart(2, '0');
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const initialMedicines = (): Medicine[] => [
  {
    id: 1, patient_id: 1, name: 'Metformin', dosage: '500 mg', form: 'tablet', color: '#7dd3fc',
    instructions: 'Take with food to minimize stomach upset', stock_count: 44, refill_threshold: 10,
    start_date: '2026-08-01', end_date: null, status: 'active',
    schedules: [{ id: 11, time_of_day: '08:00', days_mask: 'MTWTFSS' }, { id: 14, time_of_day: '20:00', days_mask: 'MTWTFSS' }]
  },
  {
    id: 2, patient_id: 1, name: 'Amlodipine', dosage: '5 mg', form: 'tablet', color: '#f472b6',
    instructions: 'Once daily in the morning at the same time', stock_count: 26, refill_threshold: 8,
    start_date: '2026-08-01', end_date: null, status: 'active',
    schedules: [{ id: 12, time_of_day: '08:00', days_mask: 'MTWTFSS' }]
  },
  {
    id: 3, patient_id: 1, name: 'Aspirin', dosage: '75 mg', form: 'tablet', color: '#fbbf24',
    instructions: 'After lunch with a full glass of water', stock_count: 19, refill_threshold: 8,
    start_date: '2026-08-01', end_date: null, status: 'active',
    schedules: [{ id: 13, time_of_day: '14:00', days_mask: 'MTWTFSS' }]
  },
  {
    id: 4, patient_id: 1, name: 'Atorvastatin', dosage: '10 mg', form: 'tablet', color: '#818cf8',
    instructions: 'At bedtime with or without food', stock_count: 13, refill_threshold: 8,
    start_date: '2026-08-01', end_date: null, status: 'active',
    schedules: [{ id: 15, time_of_day: '21:00', days_mask: 'MTWTFSS' }]
  },
  {
    id: 5, patient_id: 1, name: 'Vitamin D3', dosage: '60000 IU', form: 'capsule', color: '#34d399',
    instructions: 'Once a week with breakfast on Sunday', stock_count: 6, refill_threshold: 2,
    start_date: '2026-08-15', end_date: null, status: 'active',
    schedules: [{ id: 16, time_of_day: '09:00', days_mask: '------S' }]
  }
];

const initialDoses = (): Dose[] => {
  const ymd = todayYmd();
  return [
    {
      id: 101, medicine_id: 1, schedule_id: 11, patient_id: 1,
      scheduled_for: `${ymd}T08:00:00`, status: 'taken', taken_at: `${ymd}T08:15:00`, note: null,
      name: 'Metformin', dosage: '500 mg', form: 'tablet', color: '#7dd3fc',
      instructions: 'Take with food to minimize stomach upset', stock_count: 44, refill_threshold: 10,
      time: '08:00', slot: 'morning', state: 'taken', late: false, minutes_past: 0
    },
    {
      id: 102, medicine_id: 2, schedule_id: 12, patient_id: 1,
      scheduled_for: `${ymd}T08:00:00`, status: 'taken', taken_at: `${ymd}T08:10:00`, note: null,
      name: 'Amlodipine', dosage: '5 mg', form: 'tablet', color: '#f472b6',
      instructions: 'Once daily in the morning at the same time', stock_count: 26, refill_threshold: 8,
      time: '08:00', slot: 'morning', state: 'taken', late: false, minutes_past: 0
    },
    {
      id: 103, medicine_id: 3, schedule_id: 13, patient_id: 1,
      scheduled_for: `${ymd}T14:00:00`, status: 'taken', taken_at: `${ymd}T14:20:00`, note: 'Taken with lunch',
      name: 'Aspirin', dosage: '75 mg', form: 'tablet', color: '#fbbf24',
      instructions: 'After lunch with a full glass of water', stock_count: 19, refill_threshold: 8,
      time: '14:00', slot: 'afternoon', state: 'taken', late: false, minutes_past: 0
    },
    {
      id: 104, medicine_id: 1, schedule_id: 14, patient_id: 1,
      scheduled_for: `${ymd}T20:00:00`, status: 'pending', taken_at: null, note: null,
      name: 'Metformin', dosage: '500 mg', form: 'tablet', color: '#7dd3fc',
      instructions: 'Take with dinner', stock_count: 44, refill_threshold: 10,
      time: '20:00', slot: 'evening', state: 'due', late: false, minutes_past: 0
    },
    {
      id: 105, medicine_id: 4, schedule_id: 15, patient_id: 1,
      scheduled_for: `${ymd}T21:00:00`, status: 'pending', taken_at: null, note: null,
      name: 'Atorvastatin', dosage: '10 mg', form: 'tablet', color: '#818cf8',
      instructions: 'At bedtime', stock_count: 13, refill_threshold: 8,
      time: '21:00', slot: 'night', state: 'upcoming', late: false, minutes_past: 0
    }
  ];
};

const initialRequests = (): MedRequest[] => [
  {
    id: 1, patient_id: 1, patient_name: 'Ramesh Patel', name: 'Ibuprofen', dosage: '400 mg',
    reason: 'My knee hurts at night and I cannot sleep well. It has been persistent for a week.',
    status: 'pending', reviewer_id: null, reviewer_name: null, reviewer_note: null,
    created_at: '2026-10-04T18:20:00', decided_at: null
  },
  {
    id: 2, patient_id: 1, patient_name: 'Ramesh Patel', name: 'Pantoprazole', dosage: '40 mg',
    reason: 'Burning feeling in my chest and throat in the mornings after tea.',
    status: 'pending', reviewer_id: null, reviewer_name: null, reviewer_note: null,
    created_at: '2026-10-04T21:10:00', decided_at: null
  },
  {
    id: 3, patient_id: 1, patient_name: 'Ramesh Patel', name: 'Vitamin D3', dosage: '60000 IU',
    reason: 'My doctor recommended bone density support following recent blood test.',
    status: 'approved', reviewer_id: 3, reviewer_name: 'Dr. Meera Shah',
    reviewer_note: 'Weekly single dose approved. Take with breakfast every Sunday morning.',
    created_at: '2026-09-01T11:20:00', decided_at: '2026-09-02T09:05:00'
  }
];

const initialAlerts = (): AlertItem[] => [
  { id: 1, tracker_id: 2, patient_id: 1, patient_name: 'Ramesh Patel', type: 'missed_dose', message: 'Ramesh Patel missed Metformin 500 mg (20:00 evening dose yesterday).', read: 0, created_at: '2026-10-04T22:00:00' },
  { id: 2, tracker_id: 2, patient_id: 1, patient_name: 'Ramesh Patel', type: 'low_stock', message: 'Atorvastatin 10 mg is low on stock (13 tablets remaining). Refill due in 5 days.', read: 0, created_at: '2026-10-04T09:00:00' },
  { id: 3, tracker_id: 2, patient_id: 1, patient_name: 'Ramesh Patel', type: 'streak', message: 'Awesome! Ramesh has achieved a 14-day adherence streak.', read: 1, created_at: '2026-10-03T20:30:00' }
];

const initialAudit = (): AuditEntry[] => [
  { id: 101, actor_id: 1, actor_name: 'Ramesh Patel', actor_role: 'patient', action: 'dose.taken', entity: 'dose_logs', entity_id: 103, meta: { medicine: 'Aspirin', scheduled_for: '14:00' }, created_at: '2026-10-05T14:20:00' },
  { id: 100, actor_id: 1, actor_name: 'Ramesh Patel', actor_role: 'patient', action: 'dose.taken', entity: 'dose_logs', entity_id: 102, meta: { medicine: 'Amlodipine', scheduled_for: '08:00' }, created_at: '2026-10-05T08:10:00' },
  { id: 99, actor_id: 1, actor_name: 'Ramesh Patel', actor_role: 'patient', action: 'dose.taken', entity: 'dose_logs', entity_id: 101, meta: { medicine: 'Metformin', scheduled_for: '08:00' }, created_at: '2026-10-05T08:15:00' },
  { id: 98, actor_id: 3, actor_name: 'Dr. Meera Shah', actor_role: 'reviewer', action: 'request.approved', entity: 'medicine_requests', entity_id: 3, meta: { medicine: 'Vitamin D3' }, created_at: '2026-09-02T09:05:00' },
  { id: 97, actor_id: 2, actor_name: 'Vatsal Vyas', actor_role: 'tracker', action: 'link.created', entity: 'tracker_links', entity_id: 1, meta: { patient: 'Ramesh Patel' }, created_at: '2026-08-20T10:00:00' }
];

// Helper to access mock storage
class MockStorage {
  get<T>(key: string, fallback: () => T): T {
    try {
      const v = localStorage.getItem(`medinex_${key}`);
      if (v) return JSON.parse(v);
    } catch { /* */ }
    const init = fallback();
    this.set(key, init);
    return init;
  }
  set<T>(key: string, val: T): void {
    try {
      localStorage.setItem(`medinex_${key}`, JSON.stringify(val));
    } catch { /* */ }
  }
}
const store = new MockStorage();

function generateHeatmap(): HeatDay[] {
  const days: HeatDay[] = [];
  const today = new Date();
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const level: HeatDay['level'] = i === 4 ? 'amber' : i === 0 ? 'pending' : 'green';
    days.push({
      date: dateStr,
      total: 5,
      taken: i === 4 ? 4 : i === 0 ? 3 : 5,
      late: i % 7 === 0 ? 1 : 0,
      missed: i === 4 ? 1 : 0,
      pending: i === 0 ? 2 : 0,
      level
    });
  }
  return days;
}

const mockStats: Stats = {
  range: 30,
  adherence: 94,
  onTime: 88,
  taken: 142,
  missed: 4,
  total: 150,
  streak: { current: 14, longest: 28 },
  byMedicine: [
    { medicineId: 1, name: 'Metformin', color: '#7dd3fc', due: 60, taken: 57, adherence: 95 },
    { medicineId: 2, name: 'Amlodipine', color: '#f472b6', due: 30, taken: 29, adherence: 97 },
    { medicineId: 3, name: 'Aspirin', color: '#fbbf24', due: 30, taken: 28, adherence: 93 },
    { medicineId: 4, name: 'Atorvastatin', color: '#818cf8', due: 30, taken: 28, adherence: 93 }
  ],
  byTimeSlot: [
    { slot: 'morning', due: 60, missed: 1, missRate: 0.016 },
    { slot: 'afternoon', due: 30, missed: 1, missRate: 0.033 },
    { slot: 'evening', due: 30, missed: 2, missRate: 0.066 },
    { slot: 'night', due: 30, missed: 0, missRate: 0 }
  ],
  worstSlot: 'evening',
  heatmap: generateHeatmap(),
  notes: [
    { date: '2026-09-28', medicine: 'Amlodipine', note: 'Felt slight dizziness in morning, rested 10 mins.' },
    { date: '2026-10-01', medicine: 'Aspirin', note: 'Taken with food, no irritation.' }
  ],
  forecast: [
    { id: 1, name: 'Metformin', color: '#7dd3fc', stock_count: 44, refill_threshold: 10, dosesPerDay: 2, daysLeft: 22, low: false },
    { id: 2, name: 'Amlodipine', color: '#f472b6', stock_count: 26, refill_threshold: 8, dosesPerDay: 1, daysLeft: 26, low: false },
    { id: 3, name: 'Aspirin', color: '#fbbf24', stock_count: 19, refill_threshold: 8, dosesPerDay: 1, daysLeft: 19, low: false },
    { id: 4, name: 'Atorvastatin', color: '#818cf8', stock_count: 13, refill_threshold: 8, dosesPerDay: 1, daysLeft: 13, low: true }
  ]
};

// Response router
export async function handleMockRequest(method: string, path: string, body?: any): Promise<any> {
  const norm = path.replace(/^\/api/, '');
  const [route, query] = norm.split('?');

  // --- /demo/state ---
  if (route === '/demo/state') {
    return {
      demoMode: true,
      now: `${todayYmd()}T${new Date().toTimeString().slice(0, 8)}`,
      offsetMinutes: 0,
      accounts: DEMO_ACCOUNTS,
      ai: 'groq',
      password: 'demo',
      connected: 1
    };
  }

  // --- /auth/me ---
  if (route === '/auth/me') {
    const user = store.get<User | null>('active_user', () => null);
    if (!user) {
      const err = new Error('Not authenticated') as any;
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    return { user };
  }

  // --- /demo/switch-role ---
  if (route === '/demo/switch-role') {
    const role: Role = body?.role ?? 'patient';
    const user = DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0];
    store.set('active_user', user);
    return { user };
  }

  // --- /auth/login ---
  if (route === '/auth/login') {
    const email: string = body?.email ?? '';
    const user = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())
      || (email.includes('vatsal') ? DEMO_ACCOUNTS[1] : email.includes('meera') ? DEMO_ACCOUNTS[2] : DEMO_ACCOUNTS[0]);
    store.set('active_user', user);
    return { user };
  }

  // --- /auth/register ---
  if (route === '/auth/register') {
    const user: User = {
      id: Date.now(),
      name: body?.name || 'Registered User',
      email: body?.email || 'user@medinex.demo',
      role: body?.role || 'patient',
      avatar_seed: (body?.name || 'user').toLowerCase().replace(/\s+/g, '-')
    };
    store.set('active_user', user);
    return { user };
  }

  // --- /auth/logout ---
  if (route === '/auth/logout') {
    store.set('active_user', null);
    return { ok: true };
  }

  // --- /doses/today ---
  if (route === '/doses/today') {
    const doses = store.get<Dose[]>('doses', initialDoses);
    const takenCount = doses.filter((d) => d.status === 'taken').length;
    const nextDue = doses.find((d) => d.status === 'pending');
    return {
      now: `${todayYmd()}T${new Date().toTimeString().slice(0, 8)}`,
      date: todayYmd(),
      doses,
      progress: { taken: takenCount, total: doses.length },
      streak: { current: 14, longest: 28 },
      next: nextDue ? { id: nextDue.id, name: nextDue.name, time: nextDue.time, minutes: 30 } : null
    } as TodayResponse;
  }

  // --- /doses/:id/take ---
  const takeMatch = route.match(/^\/doses\/(\d+)\/take$/);
  if (takeMatch && method === 'POST') {
    const id = Number(takeMatch[1]);
    const doses = store.get<Dose[]>('doses', initialDoses);
    let targetDose: Dose | null = null;
    const updated = doses.map((d) => {
      if (d.id === id) {
        targetDose = {
          ...d,
          status: 'taken' as const,
          state: 'taken' as const,
          taken_at: `${todayYmd()}T${new Date().toTimeString().slice(0, 8)}`
        };
        return targetDose;
      }
      return d;
    });
    store.set('doses', updated);
    const allDone = updated.every((d) => d.status === 'taken');
    return {
      dose: targetDose ?? updated[0],
      allDone,
      streak: { current: 14, longest: 28 }
    };
  }

  // --- /doses/:id/undo ---
  const undoMatch = route.match(/^\/doses\/(\d+)\/undo$/);
  if (undoMatch && method === 'POST') {
    const id = Number(undoMatch[1]);
    const doses = store.get<Dose[]>('doses', initialDoses);
    let targetDose: Dose | null = null;
    const updated = doses.map((d) => {
      if (d.id === id) {
        targetDose = { ...d, status: 'pending' as const, state: 'due' as const, taken_at: null };
        return targetDose;
      }
      return d;
    });
    store.set('doses', updated);
    return { dose: targetDose ?? updated[0] };
  }

  // --- /doses/:id/note ---
  const noteMatch = route.match(/^\/doses\/(\d+)\/note$/);
  if (noteMatch && method === 'PATCH') {
    const id = Number(noteMatch[1]);
    const doses = store.get<Dose[]>('doses', initialDoses);
    const updated = doses.map((d) => (d.id === id ? { ...d, note: body?.note ?? '' } : d));
    store.set('doses', updated);
    return { dose: updated.find((d) => d.id === id) };
  }

  // --- /doses/history ---
  if (route === '/doses/history') {
    const doses = store.get<Dose[]>('doses', initialDoses);
    return { doses };
  }

  // --- /medicines ---
  if (route === '/medicines') {
    if (method === 'GET') {
      const medicines = store.get<Medicine[]>('medicines', initialMedicines);
      return { medicines };
    }
    if (method === 'POST') {
      const medicines = store.get<Medicine[]>('medicines', initialMedicines);
      const newMed: Medicine = {
        id: Date.now(),
        patient_id: 1,
        name: body.name || 'New Medicine',
        dosage: body.dosage || '10 mg',
        form: body.form || 'tablet',
        color: body.color || '#7dd3fc',
        instructions: body.instructions || 'As advised',
        stock_count: Number(body.stock_count) || 30,
        refill_threshold: Number(body.refill_threshold) || 8,
        start_date: todayYmd(),
        end_date: null,
        status: 'active',
        schedules: body.schedules || [{ time_of_day: '08:00', days_mask: 'MTWTFSS' }]
      };
      store.set('medicines', [newMed, ...medicines]);
      return { medicine: newMed, warnings: { interactions: [] } };
    }
  }

  // --- /medicines/:id ---
  const medIdMatch = route.match(/^\/medicines\/(\d+)$/);
  if (medIdMatch) {
    const id = Number(medIdMatch[1]);
    const medicines = store.get<Medicine[]>('medicines', initialMedicines);
    if (method === 'PATCH') {
      const updated = medicines.map((m) => (m.id === id ? { ...m, ...body } : m));
      store.set('medicines', updated);
      return { medicine: updated.find((m) => m.id === id) };
    }
    if (method === 'DELETE') {
      const updated = medicines.filter((m) => m.id !== id);
      store.set('medicines', updated);
      return { ok: true };
    }
  }

  // --- /medicines/check ---
  if (route === '/medicines/check') {
    const name = String(body?.name || '').toLowerCase();
    const interactions = [];
    if (name.includes('ibuprofen')) {
      interactions.push({
        with: 'Aspirin',
        severity: 'moderate' as const,
        note: 'Ibuprofen can blunt aspirin’s heart-protective antiplatelet effect and elevate stomach bleeding risk.'
      });
      interactions.push({
        with: 'Metformin',
        severity: 'minor' as const,
        note: 'NSAIDs like ibuprofen can alter renal hemodynamics and metformin clearance.'
      });
    }
    return { interactions, allergies: [] };
  }

  // --- /trackers/patients ---
  if (route === '/trackers/patients') {
    const doses = store.get<Dose[]>('doses', initialDoses);
    const medicines = store.get<Medicine[]>('medicines', initialMedicines);
    const rameshSummary: PatientSummary = {
      patient: PATIENT_RAMESH,
      medicines,
      today: doses,
      progress: { taken: doses.filter((d) => d.status === 'taken').length, total: doses.length },
      lastTaken: '14:20 Aspirin 75 mg',
      status: { key: 'ok', label: 'On track today' },
      streak: { current: 14, longest: 28 },
      adherence7: 96,
      adherence30: 94,
      stock: mockStats.forecast,
      stats: mockStats,
      pendingRequests: [
        { id: 1, name: 'Ibuprofen', dosage: '400 mg', reason: 'Knee discomfort at night', created_at: '2026-10-04T18:20:00' }
      ]
    };
    const sushilaSummary: PatientSummary = {
      patient: PATIENT_SUSHILA,
      medicines: [],
      today: [],
      progress: { taken: 3, total: 3 },
      lastTaken: '14:30 Calcium + D3',
      status: { key: 'ok', label: 'All doses completed' },
      streak: { current: 21, longest: 35 },
      adherence7: 100,
      adherence30: 98,
      stock: [],
      stats: mockStats,
      pendingRequests: []
    };
    return { patients: [rameshSummary, sushilaSummary] };
  }

  // --- /patients/:id/summary ---
  const patientSummaryMatch = route.match(/^\/patients\/(\d+)\/summary$/);
  if (patientSummaryMatch) {
    const id = Number(patientSummaryMatch[1]);
    const doses = store.get<Dose[]>('doses', initialDoses);
    const medicines = store.get<Medicine[]>('medicines', initialMedicines);
    return {
      patient: id === 4 ? PATIENT_SUSHILA : PATIENT_RAMESH,
      medicines: id === 4 ? [] : medicines,
      today: id === 4 ? [] : doses,
      progress: { taken: 3, total: id === 4 ? 3 : 5 },
      lastTaken: id === 4 ? '14:30 Calcium + D3' : '14:20 Aspirin 75 mg',
      status: { key: 'ok', label: 'On track today' },
      streak: { current: id === 4 ? 21 : 14, longest: 28 },
      adherence7: id === 4 ? 100 : 96,
      adherence30: id === 4 ? 98 : 94,
      stock: mockStats.forecast,
      stats: mockStats,
      pendingRequests: id === 4 ? [] : [{ id: 1, name: 'Ibuprofen', dosage: '400 mg', reason: 'Knee discomfort at night', created_at: '2026-10-04T18:20:00' }]
    };
  }

  // --- /patients/me/profile ---
  if (route === '/patients/me/profile') {
    if (method === 'PATCH') {
      return { profile: { ...PATIENT_RAMESH, ...body } };
    }
    return { profile: PATIENT_RAMESH };
  }

  // --- /requests ---
  if (route === '/requests') {
    const requests = store.get<MedRequest[]>('requests', initialRequests);
    if (method === 'POST') {
      const newReq: MedRequest = {
        id: Date.now(),
        patient_id: 1,
        patient_name: 'Ramesh Patel',
        name: body.name || 'Requested Drug',
        dosage: body.dosage || 'Standard dose',
        reason: body.reason || 'Symptom relief',
        status: 'pending',
        reviewer_id: null,
        reviewer_name: null,
        reviewer_note: null,
        created_at: new Date().toISOString(),
        decided_at: null
      };
      store.set('requests', [newReq, ...requests]);
      return { request: newReq };
    }
    return { requests };
  }

  // --- /requests/:id ---
  const reqDetailMatch = route.match(/^\/requests\/(\d+)$/);
  if (reqDetailMatch) {
    const id = Number(reqDetailMatch[1]);
    const requests = store.get<MedRequest[]>('requests', initialRequests);
    const req = requests.find((r) => r.id === id) || requests[0];
    const medicines = store.get<Medicine[]>('medicines', initialMedicines);
    return {
      request: req,
      patient: PATIENT_RAMESH,
      medicines,
      flags: {
        interactions: req.name.toLowerCase().includes('ibuprofen') ? [
          { with: 'Aspirin', severity: 'moderate' as const, note: 'Ibuprofen blunts aspirin’s cardio-protective benefits and increases stomach bleeding risk.' },
          { with: 'Metformin', severity: 'minor' as const, note: 'NSAIDs like ibuprofen can impair renal function affecting metformin clearance.' }
        ] : [],
        allergies: []
      },
      history: []
    };
  }

  // --- /requests/:id/decide ---
  const decideMatch = route.match(/^\/requests\/(\d+)\/decide$/);
  if (decideMatch && method === 'PATCH') {
    const id = Number(decideMatch[1]);
    const requests = store.get<MedRequest[]>('requests', initialRequests);
    const updated = requests.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          status: body.decision as 'approved' | 'rejected',
          reviewer_id: 3,
          reviewer_name: 'Dr. Meera Shah',
          reviewer_note: body.note || (body.decision === 'approved' ? 'Approved as prescribed.' : 'Declined due to interaction risk.'),
          decided_at: new Date().toISOString()
        };
      }
      return r;
    });
    store.set('requests', updated);
    return { request: updated.find((r) => r.id === id) };
  }

  // --- /ai/brief/:id ---
  if (route.startsWith('/ai/brief/')) {
    return {
      brief: {
        text: 'Patient Ramesh Patel (72) requests Ibuprofen 400 mg. Note: Moderate interaction with regular Aspirin 75 mg (increased GI bleeding risk & blunted antiplatelet action). Reviewer consultation advised before approval.',
        provider: 'Medi AI Engine'
      }
    };
  }

  // --- /ai/draft-request ---
  if (route === '/ai/draft-request') {
    return {
      draft: {
        reason: body.text || 'Experiencing persistent discomfort.',
        questions: ['How long have symptoms lasted?', 'Does food or movement worsen the pain?'],
        provider: 'Medi AI Assistant'
      }
    };
  }

  // --- /alerts ---
  if (route === '/alerts') {
    const alerts = store.get<AlertItem[]>('alerts', initialAlerts);
    const unread = alerts.filter((a) => !a.read).length;
    return { alerts, unread };
  }

  // --- /alerts/:id/read ---
  const alertReadMatch = route.match(/^\/alerts\/(\d+)\/read$/);
  if (alertReadMatch && method === 'PATCH') {
    const id = Number(alertReadMatch[1]);
    const alerts = store.get<AlertItem[]>('alerts', initialAlerts);
    const updated = alerts.map((a) => (a.id === id ? { ...a, read: 1 as const } : a));
    store.set('alerts', updated);
    return { ok: true };
  }

  // --- /alerts/read-all ---
  if (route === '/alerts/read-all') {
    const alerts = store.get<AlertItem[]>('alerts', initialAlerts);
    const updated = alerts.map((a) => ({ ...a, read: 1 as const }));
    store.set('alerts', updated);
    return { ok: true };
  }

  // --- /audit ---
  if (route === '/audit') {
    const entries = store.get<AuditEntry[]>('audit', initialAudit);
    return {
      entries,
      facets: {
        actions: ['dose.taken', 'request.created', 'request.approved', 'link.created', 'profile.updated'],
        entities: ['dose_logs', 'medicine_requests', 'tracker_links', 'patient_profiles']
      }
    };
  }

  // --- /analytics/adherence ---
  if (route === '/analytics/adherence') {
    return {
      patient: PATIENT_RAMESH,
      stats: mockStats
    };
  }

  // --- /links ---
  if (route === '/links') {
    const links: LinkItem[] = [
      {
        id: 1,
        patient_id: 1,
        tracker_id: 2,
        status: 'active',
        created_at: '2026-08-20T10:00:00',
        patient: DEMO_ACCOUNTS[0],
        tracker: DEMO_ACCOUNTS[1]
      }
    ];
    return { links };
  }

  // --- /demo/time-travel ---
  if (route === '/demo/time-travel') {
    return {
      now: `${todayYmd()}T${new Date().toTimeString().slice(0, 8)}`,
      flipped: 0,
      offsetMinutes: 0
    };
  }

  // --- /demo/scenario ---
  if (route === '/demo/scenario') {
    return { message: `Demo scenario '${body?.name}' simulated successfully.` };
  }

  // --- /demo/reset ---
  if (route === '/demo/reset') {
    store.set('doses', initialDoses());
    store.set('medicines', initialMedicines());
    store.set('requests', initialRequests());
    store.set('alerts', initialAlerts());
    return { ok: true };
  }

  // --- /demo/trace ---
  if (route === '/demo/trace') {
    return {
      calls: [
        { at: new Date().toISOString(), method: 'GET', path: '/api/doses/today', status: 200, ms: 14, table: 'dose_logs', rowId: 101, write: false },
        { at: new Date().toISOString(), method: 'POST', path: '/api/doses/103/take', status: 200, ms: 18, table: 'dose_logs', rowId: 103, write: true }
      ],
      counts: { users: 4, medicines: 5, dose_logs: 150, medicine_requests: 3, alerts: 3, audit_log: 98 },
      lastDose: { medicine: 'Aspirin', scheduled_for: '14:00', status: 'taken' },
      lastAudit: { action: 'dose.taken', entity: 'dose_logs' },
      dbFile: 'medinex_demo.db (SQLite)'
    };
  }

  // --- /ai/history ---
  if (route === '/ai/history') {
    if (method === 'DELETE') return { ok: true };
    return {
      messages: [
        { id: 'm1', role: 'assistant', content: 'Hello! I am Medi, your AI medication companion. How can I help you with your doses, schedule, or questions today?' }
      ],
      provider: 'Medi AI Engine'
    };
  }

  return {};
}

// Interceptor to hook into window.fetch and EventSource
export function installMockInterceptor(): void {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Check if this is an API call
    if (urlStr.includes('/api/')) {
      const pathWithApi = urlStr.slice(urlStr.indexOf('/api/'));
      const method = (init?.method || 'GET').toUpperCase();

      // Special handling for streaming /api/ai/chat
      if (pathWithApi.startsWith('/api/ai/chat')) {
        let msg = '';
        try {
          if (init?.body) msg = JSON.parse(String(init.body)).message || '';
        } catch { /* */ }

        let reply = "I'm Medi, your medication companion! Today you have 5 scheduled doses. 3 doses (Metformin morning, Amlodipine, Aspirin) are taken, and your evening doses (Metformin 20:00 and Atorvastatin 21:00) are upcoming.";
        if (msg.toLowerCase().includes('aspirin') || msg.toLowerCase().includes('ibuprofen')) {
          reply = "Caution: Ibuprofen and Aspirin have a moderate interaction. Ibuprofen can blunt aspirin's cardioprotective effect and increase gastrointestinal bleeding risk. Always consult Dr. Meera Shah before taking them together.";
        } else if (msg.toLowerCase().includes('metformin')) {
          reply = "Metformin 500 mg is prescribed twice daily with food (08:00 morning and 20:00 evening) to help regulate blood glucose and minimize stomach irritation.";
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'meta', provider: 'Medi (Demo Engine)' })}\n\n`));
            const words = reply.split(' ');
            for (const w of words) {
              await new Promise((r) => setTimeout(r, 40));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: w + ' ' })}\n\n`));
            }
            controller.close();
          }
        });

        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
        });
      }

      // If we are on static host or if real backend isn't reachable
      if (isStaticHost()) {
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : undefined;
          const result = await handleMockRequest(method, pathWithApi, body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          if (err?.status === 401) {
            return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ error: { code: 'ERROR', message: err?.message || 'Error' } }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // If on localhost or custom server, try real fetch first; fallback on 404/network error
      try {
        const res = await originalFetch(input, init);
        if (res.status === 404 || res.status >= 500) {
          const body = init?.body ? JSON.parse(String(init.body)) : undefined;
          const result = await handleMockRequest(method, pathWithApi, body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return res;
      } catch (networkErr) {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const result = await handleMockRequest(method, pathWithApi, body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return originalFetch(input, init);
  };

  // Mock EventSource for static mode
  if (isStaticHost()) {
    const OriginalEventSource = window.EventSource;
    (window as any).EventSource = function (url: string) {
      if (url.includes('/api/events')) {
        const listeners: Record<string, ((e: any) => void)[]> = {};
        const mockEs = {
          readyState: 1,
          close: () => { mockEs.readyState = 2; },
          addEventListener: (type: string, cb: (e: any) => void) => {
            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(cb);
          },
          removeEventListener: (type: string, cb: (e: any) => void) => {
            listeners[type] = (listeners[type] || []).filter((x) => x !== cb);
          },
          onmessage: null,
          onerror: null
        };
        setTimeout(() => {
          if (listeners['hello']) {
            listeners['hello'].forEach((cb) => cb({ data: JSON.stringify({ now: `${todayYmd()}T${new Date().toTimeString().slice(0, 8)}` }) }));
          }
        }, 100);
        return mockEs;
      }
      return new OriginalEventSource(url);
    };
  }
}
