import { db } from '../db/index.js';

// Very small allergy "class" map so e.g. Amoxicillin trips a Penicillin allergy.
const ALLERGY_CLASSES = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'cloxacillin'],
  sulfa: ['sulfa', 'sulfamethoxazole', 'cotrimoxazole', 'bactrim'],
  aspirin: ['aspirin', 'ecosprin', 'disprin'],
  nsaid: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin'],
  cephalosporin: ['cephalexin', 'cefixime', 'ceftriaxone'],
};

const norm = (s) => (s || '').toLowerCase();

export function interactionFlags(candidateName, currentNames) {
  const rules = db.prepare('SELECT * FROM interaction_rules').all();
  const cand = norm(candidateName);
  const flags = [];
  for (const other of currentNames) {
    const o = norm(other);
    for (const r of rules) {
      const a = norm(r.drug_a), b = norm(r.drug_b);
      if ((cand.includes(a) && o.includes(b)) || (cand.includes(b) && o.includes(a))) {
        flags.push({ with: other, severity: r.severity, note: r.note, pair: `${r.drug_a} + ${r.drug_b}` });
      }
    }
  }
  return flags;
}

export function allergyFlags(candidateName, allergiesText) {
  const cand = norm(candidateName);
  const allergies = norm(allergiesText).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const flags = [];
  for (const a of allergies) {
    const cls = Object.entries(ALLERGY_CLASSES).find(([k]) => a.includes(k));
    const names = cls ? cls[1] : [a];
    if (cand && names.some((n) => cand.includes(n))) flags.push({ allergy: a, note: `Patient lists an allergy to ${a}.` });
  }
  return flags;
}

export function checkCandidate(patientId, candidateName) {
  const meds = db.prepare("SELECT name FROM medicines WHERE patient_id=? AND status='active'").all(patientId).map((m) => m.name);
  const profile = db.prepare('SELECT allergies FROM patient_profiles WHERE user_id=?').get(patientId);
  return {
    interactions: interactionFlags(candidateName, meds),
    allergies: allergyFlags(candidateName, profile?.allergies),
  };
}

export const worstSeverity = (flags) =>
  flags.some((f) => f.severity === 'major') ? 'major' : flags.some((f) => f.severity === 'moderate') ? 'moderate' : flags.length ? 'minor' : 'none';
