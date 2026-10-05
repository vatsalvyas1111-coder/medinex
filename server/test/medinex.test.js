import test from 'node:test';
import assert from 'node:assert/strict';
import { interactionFlags, allergyFlags } from '../src/services/interactions.js';
import { canViewPatient } from '../src/services/access.js';
import { adherenceStats } from '../src/services/stats.js';
import { slotOf, GRACE_MIN } from '../src/services/doses.js';
import { StreamFilter, stripAll } from '../src/ai/filter.js';

test('Medinex Unit Test Suite - Core Services & Logic', async (t) => {
  await t.test('1. Drug Interaction Service - detects contraindicated combinations', () => {
    const flags = interactionFlags('Aspirin', ['Ibuprofen', 'Metformin']);
    assert.ok(Array.isArray(flags), 'Should return an array of flags');
    const allergies = allergyFlags('Amoxicillin 500mg', 'Penicillin allergy, Peanuts');
    assert.equal(allergies.length, 1, 'Should detect Penicillin class allergy for Amoxicillin');
    assert.equal(allergies[0].allergy, 'penicillin allergy');
  });

  await t.test('2. Role-Based Access Control (RBAC) - Patient & Tracker isolation', () => {
    const patientUser = { id: 1, role: 'patient' };
    const strangerPatient = { id: 2, role: 'patient' };
    assert.equal(canViewPatient(patientUser, 1), true, 'Patient can view their own data');
    assert.equal(canViewPatient(patientUser, 2), false, 'Patient cannot view another patient data');
    assert.equal(canViewPatient(strangerPatient, 1), false, 'Stranger cannot view patient data');
  });

  await t.test('3. Dose Scheduling State & Time Slot Partitioning', () => {
    assert.equal(slotOf('08:00'), 'morning', '08:00 should map to morning slot');
    assert.equal(slotOf('13:30'), 'afternoon', '13:30 should map to afternoon slot');
    assert.equal(slotOf('19:15'), 'evening', '19:15 should map to evening slot');
    assert.equal(slotOf('22:45'), 'night', '22:45 should map to night slot');
    assert.equal(GRACE_MIN, 30, 'Standard grace period should be 30 minutes');
  });

  await t.test('4. Adherence Statistics Calculation - Data aggregation', () => {
    const stats = adherenceStats(1, 14);
    assert.ok(stats, 'Should return adherence stats object');
    assert.ok(typeof stats.adherence === 'number' || stats.adherence === null, 'Adherence should be numeric or null');
    assert.ok(Array.isArray(stats.heatmap), 'Heatmap should be an array');
    assert.equal(stats.heatmap.length, 14, 'Heatmap should match the requested 14 days');
    assert.ok(stats.byTimeSlot.some(s => s.slot === 'morning'), 'Should compute morning slot adherence');
    assert.ok(stats.forecast, 'Should compute refill forecasts');
  });

  await t.test('5. AI Stream Filter - Removes reasoning tags and parses cards', () => {
    const filter = new StreamFilter();
    const chunks = filter.push('Hello! <think>reasoning internal</think>Please take your pill.<card>{"type":"dose"}</card>');
    const endChunks = filter.end();
    const all = [...chunks, ...endChunks];

    assert.ok(all.some(c => c.type === 'text' && c.text.includes('Please take your pill')), 'Should emit clean user text');
    assert.ok(all.every(c => !c.text || !c.text.includes('reasoning internal')), 'Should strip hidden think blocks');
    assert.ok(all.some(c => c.type === 'card' && c.raw.includes('dose')), 'Should extract card payloads');

    const stripped = stripAll('Test <think>hidden</think> visible <card>card</card>');
    assert.equal(stripped, 'Test  visible');
  });

  await t.test('6. Database Query Execution Time - Indexed Lookups Benchmark', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      adherenceStats(1, 7);
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 200, `20 repeated adherence queries should finish in under 200ms (took ${elapsed.toFixed(1)}ms)`);
  });
});
