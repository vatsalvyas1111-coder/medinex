export type Role = 'patient' | 'tracker' | 'reviewer';
export interface User { id: number; name: string; email: string; role: Role; avatar_seed: string }
export type DoseStatus = 'taken' | 'missed' | 'skipped' | 'pending';
export type DoseState = 'upcoming' | 'due' | 'overdue' | 'taken' | 'missed' | 'skipped' | 'pending';
export type Slot = 'morning' | 'afternoon' | 'evening' | 'night';
export type Form = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops';

export interface Dose {
  id: number; medicine_id: number; schedule_id: number; patient_id: number; scheduled_for: string;
  status: DoseStatus; taken_at: string | null; note: string | null;
  name: string; dosage: string; form: Form; color: string; instructions: string; stock_count: number; refill_threshold: number;
  time: string; slot: Slot; state: DoseState; late: boolean; minutes_past: number;
}
export interface TodayResponse {
  now: string; date: string; doses: Dose[]; progress: { taken: number; total: number };
  streak: { current: number; longest: number }; next: { id: number; name: string; time: string; minutes: number } | null;
}
export interface Schedule { id?: number; time_of_day: string; days_mask: string }
export interface Medicine {
  id: number; patient_id: number; name: string; dosage: string; form: Form; color: string; instructions: string;
  stock_count: number; refill_threshold: number; start_date: string; end_date: string | null;
  status: 'active' | 'paused' | 'completed'; schedules: Schedule[];
}
export interface InteractionFlag { with: string; severity: 'minor' | 'moderate' | 'major'; note: string; pair?: string }
export interface AllergyFlag { allergy: string; note: string }
export interface PatientBasics { id: number; name: string; email: string; avatar_seed: string; dob: string | null; age: number | null; allergies: string; conditions: string; emergency_contact: string; phone: string }
export interface HeatDay { date: string; total: number; taken: number; late: number; missed: number; pending: number; level: 'none' | 'pending' | 'green' | 'amber' | 'red' }
export interface Forecast { id: number; name: string; color: string; stock_count: number; refill_threshold: number; dosesPerDay: number; daysLeft: number | null; low: boolean }
export interface Stats {
  range: number; adherence: number | null; onTime: number | null; taken: number; missed: number; total: number;
  streak: { current: number; longest: number };
  byMedicine: { medicineId: number; name: string; color: string; due: number; taken: number; adherence: number | null }[];
  byTimeSlot: { slot: Slot; due: number; missed: number; missRate: number }[];
  worstSlot: Slot | null; heatmap: HeatDay[]; notes: { date: string; medicine: string; note: string }[]; forecast: Forecast[];
}
export interface PatientSummary {
  patient: PatientBasics; medicines: Medicine[]; today: Dose[]; progress: { taken: number; total: number };
  lastTaken: string | null; status: { key: 'ok' | 'missed' | 'attention' | 'overdue'; label: string };
  streak: { current: number; longest: number }; adherence7: number | null; adherence30: number | null;
  stock: Forecast[]; stats: Stats; pendingRequests: { id: number; name: string; dosage: string; reason: string; created_at: string }[];
}
export interface AlertItem { id: number; tracker_id: number; patient_id: number; patient_name: string; type: string; message: string; read: 0 | 1; created_at: string }
export interface MedRequest {
  id: number; patient_id: number; patient_name: string; name: string; dosage: string; reason: string;
  status: 'pending' | 'approved' | 'rejected'; reviewer_id: number | null; reviewer_name: string | null; reviewer_note: string | null; created_at: string; decided_at: string | null;
}
export interface LinkItem { id: number; patient_id: number; tracker_id: number; status: 'pending' | 'active'; created_at: string; patient: User; tracker: User }
export interface AuditEntry { id: number; actor_id: number | null; actor_name: string | null; actor_role: Role | null; action: string; entity: string; entity_id: number | null; meta: Record<string, unknown>; created_at: string }

export type CardSpec =
  | { type: 'dose_summary'; data: { patient: string; taken: number; total: number; doses: { id: number; name: string; dosage: string; time: string; state: DoseState; color: string; form: Form }[] } }
  | { type: 'adherence'; data: { patient: string; adherence: number | null; onTime: number | null; streak: number; worstSlot: Slot | null; days: { date: string; level: HeatDay['level'] }[] } }
  | { type: 'refill'; data: { patient: string; items: { name: string; color: string; left: number; daysLeft: number | null; low: boolean }[] } }
  | { type: 'request_summary'; data: { requestId: number; patient: string; medicine: string; reason: string; currentCount: number; flags: InteractionFlag[]; allergyFlags: string[]; overall: string } };
export interface ChatMsg { id: string | number; role: 'user' | 'assistant'; content: string; card?: CardSpec | null; streaming?: boolean; error?: boolean }
