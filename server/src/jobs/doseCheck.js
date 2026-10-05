import cron from 'node-cron';
import { runDoseCheck } from '../services/doses.js';

/** Every minute: create today's pending rows, flip overdue (>2h) doses to 'missed', alert trackers. */
export function startDoseCheck() {
  const tick = () => { try { const n = runDoseCheck(); if (n) console.log(`[cron] flipped ${n} dose(s) to missed`); } catch (e) { console.error('[cron]', e); } };
  tick();
  cron.schedule('* * * * *', tick);
}
