import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Flame, Phone, Printer, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useMe } from '../lib/hooks';
import { greeting, relative, useNow, SLOT_LABEL } from '../lib/time';
import { rise, stagger } from '../lib/motion';
import type { PatientSummary } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { CompareChart } from '../components/Charts';
import { EmptyAlerts, EmptyState } from '../components/Illustrations';
import { InsightCard } from '../components/InsightCard';
import { MiniRing } from '../components/Ring';
import { PageSkeleton } from '../components/Skeleton';
import { useUI } from '../lib/store';

export const STATUS_STYLE = { ok: 'bg-leaf/20 text-leaf', missed: 'bg-amber/25 text-amber', overdue: 'bg-amber/25 text-amber', attention: 'bg-coral/20 text-coral' } as const;
const telOf = (s: string) => s.replace(/[^\d+]/g, '');

export function PatientCard({ p, index = 0 }: { p: PatientSummary; index?: number }) {
  const now = useNow(30000); const first = p.patient.name.split(' ')[0];
  const pct = p.progress.total ? p.progress.taken / p.progress.total : 0;
  return (
    <motion.div variants={rise} custom={index}>
      <div className="card card-lift relative p-5"><Link to={`/patients/${p.patient.id}`} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={`Open ${p.patient.name}`} />
        <div className="pointer-events-none relative z-10">
        <div className="flex items-start gap-4">
          <Avatar seed={p.patient.avatar_seed} name={p.patient.name} size={60} ring />
          <div className="min-w-0 flex-1"><h3 className="font-display text-2xl font-semibold leading-tight">{p.patient.name}</h3><p className="text-sm text-muted">{p.patient.age} yrs · {p.patient.conditions.split(',')[0]}</p>
            <span className={`chip mt-2 ${STATUS_STYLE[p.status.key]}`}><motion.span className="h-2 w-2 rounded-full bg-current" animate={p.status.key !== 'ok' ? { scale: [1, 1.6, 1] } : {}} transition={{ repeat: Infinity, duration: 1.4 }} />{p.status.label}</span></div>
          <MiniRing value={pct} size={66} stroke={8} label={`${p.progress.taken}/${p.progress.total}`} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-ink/5 p-2.5"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">Last dose</dt><dd className="mt-0.5 text-sm font-extrabold">{p.lastTaken ? relative(p.lastTaken, now) : '—'}</dd></div>
          <div className="rounded-xl bg-ink/5 p-2.5"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">7-day</dt><dd className="mt-0.5 text-sm font-extrabold">{p.adherence7 ?? '—'}%</dd></div>
          <div className="rounded-xl bg-ink/5 p-2.5"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">Streak</dt><dd className="mt-0.5 flex items-center justify-center gap-1 text-sm font-extrabold"><Flame className="h-4 w-4 text-amber" />{p.streak.current}d</dd></div>
        </dl>
        </div>
        {p.patient.phone && <a href={`tel:${telOf(p.patient.phone)}`} className="btn-ghost relative z-10 mt-3 w-full !min-h-[44px] !text-sm"><Phone className="h-4 w-4 text-teal" />Call {first}</a>}
      </div>
    </motion.div>
  );
}

export default function TrackerDashboard() {
  const { data: me } = useMe(); const now = useNow(60000); const { askMedi } = useUI();
  const q = useQuery({ queryKey: ['tracker-patients'], queryFn: () => api.get<{ patients: PatientSummary[] }>('/trackers/patients') });
  if (q.isLoading) return <PageSkeleton rows={2} ring />;
  const ps = q.data?.patients ?? [];
  const rows = ps.map((p) => ({ name: p.patient.name.split(' ')[0], d7: p.adherence7, d30: p.adherence30 }));
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end gap-3"><div><p className="font-semibold text-muted">{greeting(now)}, {me?.name.split(' ')[0]}</p><h1 className="h-page">Your <span className="gradient-text">family</span> at a glance</h1></div>
        <div className="ml-auto flex gap-2 no-print"><button className="btn-ghost" onClick={() => askMedi(`How has ${ps[0]?.patient.name.split(' ')[0] ?? 'my patient'} been this week?`)}><Sparkles className="h-5 w-5 text-teal" />Ask Medi</button><button className="btn-ghost" onClick={() => window.print()}><Printer className="h-5 w-5" />Report</button></div></header>
      {ps.length === 0 ? <EmptyState art={<EmptyAlerts />} title="No linked patients yet" body="When a patient invites you, they will appear here." action={<Link to="/links" className="btn-primary">Open invitations</Link>} /> : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">
          <motion.div variants={rise} className="grid gap-5 lg:grid-cols-2">{ps.map((p) => <InsightCard key={p.patient.id} patientId={p.patient.id} title={`${p.patient.name.split(' ')[0]}’s weekly digest`} />)}</motion.div>
          <div className="grid gap-5 md:grid-cols-2">{ps.map((p, i) => <PatientCard key={p.patient.id} p={p} index={i} />)}</div>
          {ps.length > 1 && <motion.section variants={rise} className="card p-5"><h2 className="font-display text-xl font-semibold">Comparison</h2><p className="mb-2 text-sm text-muted">Adherence across the people you follow.</p><CompareChart rows={rows} />
            <div className="mt-3 flex flex-wrap gap-2">{ps.map((p) => <span key={p.patient.id} className="chip bg-ink/8 text-muted">{p.patient.name.split(' ')[0]} · most missed: <b className="capitalize text-ink">{p.stats.worstSlot ? SLOT_LABEL[p.stats.worstSlot] : 'none'}</b></span>)}</div></motion.section>}
        </motion.div>)}
    </div>
  );
}
