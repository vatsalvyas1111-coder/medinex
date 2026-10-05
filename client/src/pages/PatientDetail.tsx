import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Flame, Phone, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useUI } from '../lib/store';
import { fmtDay, SLOT_LABEL } from '../lib/time';
import type { HeatDay, PatientSummary, Slot } from '../lib/types';
import { AnalyticsView } from '../components/AnalyticsView';
import { Avatar } from '../components/Avatar';
import { DoseCard } from '../components/DoseCard';
import { CalendarHeatmap } from '../components/Heatmap';
import { InsightCard } from '../components/InsightCard';
import { MiniRing } from '../components/Ring';
import { PageSkeleton } from '../components/Skeleton';
import { DayEntries } from './History';
import { STATUS_STYLE } from './TrackerDashboard';

export default function PatientDetail() {
  const { id } = useParams(); const { askMedi } = useUI(); const [sel, setSel] = useState<HeatDay | null>(null);
  const q = useQuery({ queryKey: ['summary', id], queryFn: () => api.get<PatientSummary>(`/patients/${id}/summary`) });
  if (q.isLoading || !q.data) return <PageSkeleton rows={3} ring />;
  const p = q.data; const first = p.patient.name.split(' ')[0];
  const slots = (['morning', 'afternoon', 'evening', 'night'] as Slot[]).filter((s) => p.today.some((d) => d.slot === s));
  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All patients</Link>
      <header className="card flex flex-wrap items-center gap-5 p-5">
        <Avatar seed={p.patient.avatar_seed} name={p.patient.name} size={78} ring />
        <div className="min-w-0 flex-1"><h1 className="font-display text-3xl font-semibold sm:text-4xl">{p.patient.name}</h1><p className="text-muted">{p.patient.age} yrs · {p.patient.conditions}</p>
          <div className="mt-2 flex flex-wrap gap-2"><span className={`chip ${STATUS_STYLE[p.status.key]}`}>{p.status.label}</span><span className="chip bg-coral/15 text-coral">Allergies: {p.patient.allergies || 'none'}</span><span className="chip bg-amber/20 text-amber"><Flame className="h-3.5 w-3.5" />{p.streak.current}-day streak</span></div></div>
        <MiniRing value={p.progress.total ? p.progress.taken / p.progress.total : 0} size={84} stroke={10} label={`${p.progress.taken}/${p.progress.total}`} />
        <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
          {p.patient.phone && <a className="btn-primary flex-1" href={`tel:${p.patient.phone.replace(/[^\d+]/g, '')}`}><Phone className="h-5 w-5" />Call {first}</a>}
          <button className="btn-ghost flex-1" onClick={() => askMedi(`How has ${first} been this week?`)}><Sparkles className="h-5 w-5 text-teal" />Ask Medi</button></div>
      </header>

      <InsightCard patientId={p.patient.id} title={`${first}’s weekly digest`} />

      <section aria-label="Today's timeline (read only)"><h2 className="mb-3 font-display text-2xl font-semibold">Today</h2>
        <div className="space-y-6">{slots.map((s) => (<div key={s}><p className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">{SLOT_LABEL[s]}</p>
          <div className="grid gap-3 md:grid-cols-2"><AnimatePresence>{p.today.filter((d) => d.slot === s).map((d, i) => <DoseCard key={d.id} dose={d} readOnly index={i} onTake={() => {}} onUndo={() => {}} />)}</AnimatePresence></div></div>))}</div></section>

      <section className="grid gap-5 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2"><h2 className="mb-3 font-display text-xl font-semibold">30-day heatmap</h2><CalendarHeatmap days={p.stats.heatmap} selected={sel?.date} onSelect={setSel} compact /></div>
        <div className="card p-5 lg:col-span-3"><AnimatePresence mode="wait">{sel ? <motion.div key={sel.date} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><h2 className="font-display text-xl font-semibold">{fmtDay(sel.date)}</h2><p className="mb-3 text-sm text-muted">{sel.taken}/{sel.total} taken</p><DayEntries patientId={p.patient.id} date={sel.date} /></motion.div> : <motion.p key="none" className="py-10 text-center text-muted">Select a day on the heatmap to see its entries.</motion.p>}</AnimatePresence></div>
      </section>

      <AnalyticsView patientId={p.patient.id} compact />
    </div>
  );
}
