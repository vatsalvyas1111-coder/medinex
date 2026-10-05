// The ONE source of "now". Every server timestamp goes through clock.now() so the demo can time-travel.
import { getSetting, setSetting } from '../db/index.js';

const pad = (n) => String(n).padStart(2, '0');
let cachedOffset = null;

export const clock = {
  offsetMinutes() {
    if (cachedOffset === null) cachedOffset = Number(getSetting('demo_clock_offset_minutes', '0')) || 0;
    return cachedOffset;
  },
  setOffset(min) { cachedOffset = Math.round(min); setSetting('demo_clock_offset_minutes', cachedOffset); },
  addMinutes(min) { this.setOffset(this.offsetMinutes() + min); },
  invalidate() { cachedOffset = null; },
  now() { return new Date(Date.now() + this.offsetMinutes() * 60000); },
  /** local wall-clock string 'YYYY-MM-DDTHH:MM:SS' (APP_TZ) */
  stamp(d = this.now()) { return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; },
  today() { return dateStr(this.now()); },
  /** jump to a local time (HH:MM) on the day after the current demo day */
  jumpToNextDay(hhmm = '06:30') {
    const n = this.now();
    const [h, m] = hhmm.split(':').map(Number);
    const target = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, h, m, 0);
    this.addMinutes(Math.round((target.getTime() - n.getTime()) / 60000));
  },
  /** set demo clock to today at HH:MM (real today) */
  setToTodayAt(hhmm) {
    const real = new Date();
    const [h, m] = hhmm.split(':').map(Number);
    const target = new Date(real.getFullYear(), real.getMonth(), real.getDate(), h, m, 0);
    this.setOffset(Math.round((target.getTime() - real.getTime()) / 60000));
  },
};

export function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function addDays(dateString, n) {
  const [y, m, d] = dateString.split('-').map(Number);
  return dateStr(new Date(y, m - 1, d + n));
}
/** parse 'YYYY-MM-DD[T ]HH:MM[:SS]' as local wall time */
export function parseStamp(s) {
  const [d, t = '00:00:00'] = s.replace(' ', 'T').split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi, se = 0] = t.split(':').map(Number);
  return new Date(y, mo - 1, da, h, mi, se);
}
export function minutesBetween(a, b) { return (parseStamp(b) - parseStamp(a)) / 60000; }
export function weekdayIndex(dateString) { // Monday=0 … Sunday=6
  const [y, m, d] = dateString.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}
