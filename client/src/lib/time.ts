import { useEffect, useState } from 'react';
import { create } from 'zustand';

/** Parse a server wall-clock stamp ('YYYY-MM-DDTHH:MM[:SS]') into a local Date with the same components. */
export function parseStamp(s: string): Date {
  const [d, t = '00:00:00'] = s.replace(' ', 'T').split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi, se = 0] = t.split(':').map(Number);
  return new Date(y, mo - 1, da, h, mi, se);
}

/** The demo clock: difference between the server's (possibly time-travelled) "now" and this browser's clock. */
interface ClockState { offsetMs: number; sync: (stamp: string) => void }
export const useClockStore = create<ClockState>((set) => ({
  offsetMs: 0,
  sync: (stamp) => set({ offsetMs: parseStamp(stamp).getTime() - Date.now() }),
}));
export const serverNow = () => new Date(Date.now() + useClockStore.getState().offsetMs);

export function useNow(intervalMs = 1000): Date {
  const offset = useClockStore((s) => s.offsetMs);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return new Date(Date.now() + offset);
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function greeting(d: Date) { const h = d.getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'; }
export function fmtTime(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; }
export function fmtStamp(s: string | null | undefined) { return s ? fmtTime(s.slice(11, 16)) : '—'; }
export function fmtDay(s: string) { return parseStamp(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); }
export function fmtLong(d: Date) { return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }); }
export function relative(stamp: string, now: Date) {
  const mins = Math.round((now.getTime() - parseStamp(stamp).getTime()) / 60000);
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}
export function countdown(mins: number) {
  if (mins < 1) return 'now'; if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60; return m ? `${h}h ${m}m` : `${h}h`;
}
export const SLOT_LABEL: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
