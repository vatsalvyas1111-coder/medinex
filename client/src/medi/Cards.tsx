import { motion } from 'framer-motion';
import { AlertTriangle, Flame, ShieldAlert } from 'lucide-react';
import { PillIcon } from '../components/PillIcon';
import { Ring } from '../components/Ring';
import { fmtTime } from '../lib/time';
import type { CardSpec } from '../lib/types';

const DOT: Record<string, string> = { taken: 'bg-leaf', missed: 'bg-coral', overdue: 'bg-amber', due: 'bg-teal', upcoming: 'bg-ink/25', pending: 'bg-ink/25', skipped: 'bg-ink/25' };
const HEAT: Record<string, string> = { green: 'heat-green', amber: 'heat-amber', red: 'heat-red', none: 'heat-none', pending: 'heat-pending' };
const SEV: Record<string, string> = { major: 'bg-coral/20 text-coral', moderate: 'bg-amber/25 text-amber', minor: 'bg-ink/10 text-muted' };

/** Rich, natively-rendered response cards. Numbers come from the server (never from the model). */
export function MediCard({ card }: { card: CardSpec }) {
  const wrap = (children: React.ReactNode) => <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="mt-2 rounded-2xl border border-line/10 bg-surface/70 p-3.5">{children}</motion.div>;
  if (card.type === 'dose_summary') {
    const d = card.data; return wrap(<>
      <div className="flex items-center gap-3"><Ring value={d.total ? d.taken / d.total : 0} size={54} stroke={7}><span className="text-sm font-extrabold">{d.taken}/{d.total}</span></Ring>
        <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Today · {d.patient.split(' ')[0]}</p><p className="font-bold">{d.taken} of {d.total} doses taken</p></div></div>
      <ul className="mt-3 space-y-1.5">{d.doses.map((x) => (
        <li key={x.id} className="flex items-center gap-2.5 text-[14px]"><PillIcon form={x.form} color={x.color} size={24} name={x.name} /><span className="font-semibold">{x.name}</span><span className="text-muted">{x.dosage}</span>
          <span className="ml-auto text-muted">{fmtTime(x.time)}</span><span className={`h-2.5 w-2.5 rounded-full ${DOT[x.state] ?? 'bg-ink/25'}`} title={x.state} /></li>))}</ul></>);
  }
  if (card.type === 'adherence') {
    const d = card.data; return wrap(<>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">14-day adherence · {d.patient.split(' ')[0]}</p>
      <div className="mt-1 flex items-end gap-4"><p className="font-display text-4xl font-semibold leading-none">{d.adherence ?? '—'}<span className="text-lg text-muted">%</span></p>
        <div className="pb-0.5 text-sm text-muted"><p>{d.onTime ?? '—'}% on time</p><p className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-amber" />{d.streak}-day streak</p></div></div>
      <div className="mt-3 flex gap-1">{d.days.map((x, i) => <motion.span key={x.date} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.03 }} title={x.date} className={`h-7 flex-1 origin-bottom rounded-md ${HEAT[x.level]}`} />)}</div>
      {d.worstSlot && <p className="mt-2 text-sm text-muted">Most missed: <b className="capitalize text-ink">{d.worstSlot}</b></p>}</>);
  }
  if (card.type === 'refill') {
    const d = card.data; return wrap(<>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Refill check · {d.patient.split(' ')[0]}</p>
      <ul className="mt-2 space-y-2">{d.items.map((x) => (
        <li key={x.name} className="text-[14px]"><div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.name}</span>
          <span className={x.low ? 'font-bold text-coral' : 'text-muted'}>{x.left} left{x.daysLeft != null ? ` · ~${x.daysLeft}d` : ''}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10"><motion.div className={`h-full rounded-full ${x.low ? 'bg-coral' : 'bg-teal'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((x.daysLeft ?? 0) / 30) * 100)}%` }} transition={{ duration: 0.8 }} /></div></li>))}</ul></>);
  }
  const d = card.data; return wrap(<>
    <p className="text-xs font-bold uppercase tracking-wider text-muted">Request · {d.patient}</p>
    <p className="mt-0.5 font-display text-xl font-semibold">{d.medicine}</p><p className="text-sm text-muted">“{d.reason}”</p>
    <div className="mt-2 flex flex-wrap gap-1.5"><span className="chip bg-ink/8 text-muted">{d.currentCount} current medicines</span>
      {d.flags.map((f) => <span key={f.with} className={`chip ${SEV[f.severity]}`}><AlertTriangle className="h-3 w-3" />{f.severity} · {f.with}</span>)}
      {d.allergyFlags.map((a) => <span key={a} className="chip bg-coral/20 text-coral"><ShieldAlert className="h-3 w-3" />Allergy</span>)}
      {!d.flags.length && !d.allergyFlags.length && <span className="chip bg-leaf/20 text-leaf">No flags</span>}</div></>);
}
