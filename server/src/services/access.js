// Central permission logic. Routes call these; the UI is never the only gate.
import { db } from '../db/index.js';

export const activeTrackerIds = (patientId) =>
  db.prepare("SELECT tracker_id id FROM tracker_links WHERE patient_id=? AND status='active'").all(patientId).map((r) => r.id);
export const linkedPatientIds = (trackerId) =>
  db.prepare("SELECT patient_id id FROM tracker_links WHERE tracker_id=? AND status='active'").all(trackerId).map((r) => r.id);
export const reviewerIds = () => db.prepare("SELECT id FROM users WHERE role='reviewer'").all().map((r) => r.id);

/** May `user` read `patientId`'s health data? */
export function canViewPatient(user, patientId) {
  patientId = Number(patientId);
  if (user.role === 'patient') return user.id === patientId;
  if (user.role === 'tracker') return linkedPatientIds(user.id).includes(patientId);
  if (user.role === 'reviewer') {
    // reviewers only see patients who have submitted a request (need-to-know)
    return !!db.prepare('SELECT 1 FROM medicine_requests WHERE patient_id=? LIMIT 1').get(patientId);
  }
  return false;
}
