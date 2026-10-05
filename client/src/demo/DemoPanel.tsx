import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Clock, Database, FastForward, FlaskConical, Inbox, PackageMinus, RotateCcw, Sunrise, Timer, TriangleAlert, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { homeFor, useMe } from '../lib/hooks';
import { useUI } from '../lib/store';
import { fmtLong, fmtTime, pad, parseStamp, useClockStore, useNow } from '../lib/time';
import type { Role, User } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { spring } from '../lib/motion';
import { DEMO_ACCOUNTS } from '../lib/mockBackend';

interface DemoState { demoMode: boolean; now: string; offsetMinutes: number; accounts: (User & { role: Role })[]; ai: 'groq' | 'local'; connected: number }
interface Trace { calls: { at: string; method: string; path: string; status: number; ms: number; table: string; rowId: number | null; write: boolean }[]; counts: Record<string, number>; lastDose: Record<string, unknown> | null; lastAudit: Record<string, unknown> | null; dbFile: string }

export function DemoPanel() {
  const { demoOpen, setDemoOpen, toast } = useUI(); const qc = useQueryClient(); const nav = useNavigate(); const { data: me } = useMe(); const loc = useLocation();
  const [hood, setHood] = useState(false); const now = useNow(1000);
  const { data: demo } = useQuery({ queryKey: ['demo-state'], queryFn: () => api.get<DemoState>('/demo/state'), retry: false, refetchInterval: 15000 });
  const { data: trace } = useQuery({ queryKey: ['demo-trace'], queryFn: () => api.get<Trace>('/demo/trace'), enabled: demoOpen && hood && !!me, refetchInterval: 1500 });
  const err = (e: unknown) => toast({ kind: 'error', title: e instanceof ApiError ? e.message : 'Demo action failed' });

  const sw = useMutation({
    mutationFn: (role: Role) => api.post<{ user: User }>('/demo/switch-role', { role }),
    onSuccess: ({ user }) => { qc.clear(); qc.setQueryData(['me'], user); nav(homeFor(user.role)); toast({ kind: 'info', title: `Signed in as ${user.name}`, body: user.role, duration: 2500 }); }, onError: err });
  const tt = useMutation({
    mutationFn: (action: string) => api.post<{ now: string; flipped: number }>('/demo/time-travel', { action }),
    onSuccess: (r, action) => { useClockStore.getState().sync(r.now); qc.invalidateQueries(); toast({ kind: 'info', title: action === 'reset' ? 'Clock reset' : 'Time travelled', body: `${fmtLong(parseStamp(r.now))} · ${fmtTime(r.now.slice(11, 16))}${r.flipped ? ` · ${r.flipped} dose(s) flagged missed` : ''}`, duration: 4000 }); }, onError: err });
  const sc = useMutation({
    mutationFn: (name: string) => api.post<{ message: string }>('/demo/scenario', { name }),
    onSuccess: (r) => { qc.invalidateQueries(); toast({ kind: 'info', title: 'Scenario triggered', body: r.message, duration: 3500 }); }, onError: err });
  const reset = useMutation({
    mutationFn: () => api.post('/demo/reset'),
    onSuccess: () => { qc.invalidateQueries(); toast({ kind: 'success', title: 'Demo data re-seeded', body: 'Fresh 30 days of history, clock reset.' }); }, onError: err });

  if (demo && !demo.demoMode) return null;
  const roles: Role[] = ['patient', 'tracker', 'reviewer'];
  const acc = (r: Role) => demo?.accounts?.find((a) => a.role === r) || DEMO_ACCOUNTS.find((a) => a.role === r);
  const onLogin = loc.pathname === '/login';

  return (
    <div className={`no-print fixed left-3 z-[62] ${me ? 'bottom-24 lg:bottom-4 lg:left-[268px]' : 'bottom-4'}`}>
      <AnimatePresence mode="wait" initial={false}>
        {!demoOpen ? (
          <motion.button key="pill" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setDemoOpen(true)}
            className="glass flex min-h-[48px] items-center gap-2 rounded-full px-4 text-sm font-bold shadow-soft" aria-label="Open demo panel"><Wand2 className="h-4 w-4 text-teal" />Demo</motion.button>
        ) : (
          <motion.div key="panel" role="dialog" aria-label="Demo panel" initial={{ opacity: 0, y: 20, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.94 }} transition={spring}
            className="glass w-[min(340px,calc(100vw-1.5rem))] origin-bottom-left overflow-hidden rounded-xl2 shadow-lift">
            <div className="flex items-center gap-2 px-4 pt-3.5"><FlaskConical className="h-[18px] w-[18px] text-teal" /><h2 className="font-display text-lg font-semibold">Demo panel</h2>
              <span className="chip ml-1 bg-ink/8 text-muted">AI: {demo?.ai === 'groq' ? 'Groq' : 'offline'}</span>
              <button className="btn-icon ml-auto !min-h-[40px] !min-w-[40px]" onClick={() => setDemoOpen(false)} aria-label="Collapse demo panel"><X className="h-4 w-4" /></button></div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 pb-4 pt-2">
              <section aria-label="Role switcher"><p className="label">Sign in as</p>
                <div className="grid grid-cols-3 gap-2">{roles.map((r) => { const a = acc(r); const active = me?.role === r; return (
                  <button key={r} onClick={() => sw.mutate(r)} disabled={sw.isPending || !a} className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-xs font-bold capitalize transition active:scale-95 ${active ? 'border-teal/60 bg-teal/15' : 'border-line/10 bg-surface/50 hover:bg-surface/90'}`}>
                    {a ? <Avatar seed={a.avatar_seed} name={a.name} size={36} /> : <span className="skeleton h-9 w-9 rounded-full" />}{r}</button>); })}</div></section>

              <section aria-label="Time travel"><p className="label flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time travel <span className="ml-auto font-bold text-ink">{fmtTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`)}</span></p>
                <p className="mb-2 -mt-1 text-xs text-muted">{fmtLong(now)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost !min-h-[44px] !text-sm" disabled={!me || tt.isPending} onClick={() => tt.mutate('+1h')}><Timer className="h-4 w-4" />+1 hr</button>
                  <button className="btn-ghost !min-h-[44px] !text-sm" disabled={!me || tt.isPending} onClick={() => tt.mutate('+6h')}><FastForward className="h-4 w-4" />+6 hr</button>
                  <button className="btn-ghost !min-h-[44px] !text-sm" disabled={!me || tt.isPending} onClick={() => tt.mutate('nextday')}><Sunrise className="h-4 w-4" />Next day</button>
                  <button className="btn-ghost !min-h-[44px] !text-sm" disabled={!me || tt.isPending} onClick={() => tt.mutate('reset')}><RotateCcw className="h-4 w-4" />Reset</button></div></section>

              <section aria-label="Scenarios"><p className="label">Scenarios</p>
                <div className="space-y-2">
                  <button className="btn-ghost w-full !justify-start !text-sm" disabled={!me || sc.isPending} onClick={() => sc.mutate('missed')}><TriangleAlert className="h-4 w-4 text-coral" />Simulate missed dose</button>
                  <button className="btn-ghost w-full !justify-start !text-sm" disabled={!me || sc.isPending} onClick={() => sc.mutate('request')}><Inbox className="h-4 w-4 text-teal" />Submit a new medicine request</button>
                  <button className="btn-ghost w-full !justify-start !text-sm" disabled={!me || sc.isPending} onClick={() => sc.mutate('low_stock')}><PackageMinus className="h-4 w-4 text-amber" />Low stock event</button></div></section>

              <button className="btn-danger w-full !text-sm" disabled={reset.isPending} onClick={() => { if (confirm('Re-seed the database? All changes will be lost.')) reset.mutate(); }}><RotateCcw className="h-4 w-4" />{reset.isPending ? 'Re-seeding…' : 'Reset demo data'}</button>

              <section aria-label="Under the hood">
                <button className="flex w-full items-center gap-2 rounded-xl py-1 text-left text-sm font-bold text-muted hover:text-ink" onClick={() => setHood((h) => !h)} aria-expanded={hood}>
                  <Database className="h-4 w-4" />Under the hood<ChevronDown className={`ml-auto h-4 w-4 transition ${hood ? 'rotate-180' : ''}`} /></button>
                <AnimatePresence initial={false}>{hood && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {!me ? <p className="pt-2 text-xs text-muted">Sign in to see live API and database activity.</p> : !trace ? <div className="skeleton mt-2 h-24" /> : (
                      <div className="mt-2 space-y-2.5 font-mono text-[11.5px] leading-snug">
                        <div className="rounded-xl bg-[#0B1020] p-2.5 text-emerald-200">
                          <p className="text-emerald-400/80">// last API call</p>
                          {trace.calls[0] ? (<><p><b className={trace.calls[0].write ? 'text-amber-300' : 'text-sky-300'}>{trace.calls[0].method}</b> {trace.calls[0].path}</p><p>→ {trace.calls[0].status} · {trace.calls[0].ms}ms</p>
                            <p>table: <b className="text-white">{trace.calls[0].table}</b>{trace.calls[0].rowId ? <> · row id <b className="text-white">{trace.calls[0].rowId}</b></> : null}</p></>) : <p>—</p>}
                        </div>
                        <div className="rounded-xl bg-ink/5 p-2.5"><p className="mb-1 font-bold text-muted">{trace.dbFile}</p>
                          <div className="grid grid-cols-2 gap-x-3">{Object.entries(trace.counts).map(([t, n]) => <p key={t} className="flex justify-between"><span className="text-muted">{t}</span><b>{n}</b></p>)}</div></div>
                        <div className="rounded-xl bg-ink/5 p-2.5"><p className="font-bold text-muted">recent calls</p>{trace.calls.slice(0, 5).map((c, i) => <p key={i} className="truncate"><b className={c.write ? 'text-amber' : 'text-teal'}>{c.method}</b> {c.path.replace('/api', '')} <span className="text-muted">→ {c.table}</span></p>)}</div>
                        {trace.lastAudit && <p className="text-muted">audit_log #{String(trace.lastAudit.id)}: {String(trace.lastAudit.action)}</p>}
                      </div>)}
                  </motion.div>)}</AnimatePresence>
              </section>
              {onLogin && <p className="text-xs text-muted">Tip: sign in as a role first, then time travel and scenarios unlock.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
