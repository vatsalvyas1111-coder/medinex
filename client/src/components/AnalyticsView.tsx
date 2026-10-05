import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Flame, Printer, Target, Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { fmtLong, useNow } from '../lib/time';
import { rise, stagger } from '../lib/motion';
import type { PatientBasics, Stats } from '../lib/types';
import { CountUp, Ring } from './Ring';
import { CalendarHeatmap } from './Heatmap';
import { MedicineBars, SlotChart, TrendChart } from './Charts';
import { PillIcon } from './PillIcon';
import { PageSkeleton, Skeleton } from './Skeleton';

export function StockForecast({ stats }: { stats: Stats }) {
  return (
    <ul className="space-y-3">
      {stats.forecast.map((f) => {
        const days = f.daysLeft; const pct = Math.min(100, ((days ?? 0) / 30) * 100);
        return (
          <li key={f.id} className="flex items-center gap-3">
            <PillIcon form="tablet" color={f.color} size={34} name={f.name} />
            <div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><span className="truncate font-bold">{f.name}</span>
              <span className={`shrink-0 text-sm font-bold ${f.low ? 'text-coral' : 'text-muted'}`}>{days == null ? '—' : days <= 0 ? 'Out of stock' : `runs out in ${days} day${days === 1 ? '' : 's'}`}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/8"><motion.div className={`h-full rounded-full ${f.low ? 'bg-coral' : 'bg-teal'}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }} /></div>
              <p className="mt-0.5 text-xs text-muted">{f.stock_count} left · {f.dosesPerDay}/day{f.low ? ' · refill soon' : ''}</p></div>
          </li>);
      })}
    </ul>
  );
}

/** Full analytics: KPIs, trend, heatmap, per-medicine, time-of-day pattern, refill forecast, printable report. */
export function AnalyticsView({ patientId, compact = false }: { patientId?: number; compact?: boolean }) {
  const [range, setRange] = useState(30); const now = useNow(60000);
  const q = useQuery({ queryKey: ['stats', patientId ?? 'me', range], queryFn: () => api.get<{ patient: PatientBasics; stats: Stats }>(`/analytics/adherence?range=${range}${patientId ? `&patientId=${patientId}` : ''}`) });
  if (q.isLoading || !q.data) return compact ? <Skeleton className="h-72" /> : <PageSkeleton rows={3} ring />;
  const { stats: s, patient } = q.data;
  const kpis = [
    { label: 'Adherence', value: s.adherence ?? 0, suffix: '%', icon: Target, ring: (s.adherence ?? 0) / 100 },
    { label: 'On time', value: s.onTime ?? 0, suffix: '%', icon: Timer, ring: (s.onTime ?? 0) / 100 },
    { label: 'Current streak', value: s.streak.current, suffix: 'd', icon: Flame, ring: Math.min(1, s.streak.current / 14) },
    { label: 'Longest streak', value: s.streak.longest, suffix: 'd', icon: Trophy, ring: Math.min(1, s.streak.longest / 30) },
  ];
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <div className="print-only"><h1 className="font-display text-3xl">Medinex monthly report</h1><p>{patient.name} · generated {fmtLong(now)} · last {range} days</p></div>
      <motion.div variants={rise} className="no-print flex flex-wrap items-center gap-3">
        <div className="glass inline-flex rounded-2xl p-1" role="tablist" aria-label="Date range">{[7, 30, 90].map((r) => (
          <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`relative min-h-[44px] rounded-xl px-5 text-sm font-bold ${range === r ? 'text-ink' : 'text-muted'}`}>
            {range === r && <motion.span layoutId={`range-${patientId ?? 'me'}`} className="absolute inset-0 rounded-xl bg-surface shadow-soft ring-1 ring-line/10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}<span className="relative">{r} days</span></button>))}</div>
        <button className="btn-ghost ml-auto" onClick={() => window.print()}><Printer className="h-5 w-5" />Export monthly report</button>
      </motion.div>

      <motion.div variants={rise} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card flex items-center gap-3 p-4">
            <Ring value={k.ring} size={62} stroke={7}><k.icon className="h-5 w-5 text-teal" /></Ring>
            <div><p className="font-display text-3xl font-semibold leading-none"><CountUp value={k.value} suffix={k.suffix} /></p><p className="mt-1 text-[13px] font-bold text-muted">{k.label}</p></div>
          </div>))}
      </motion.div>

      <div className={`grid gap-5 ${compact ? '' : 'lg:grid-cols-5'}`}>
        <motion.section variants={rise} className={`card p-5 ${compact ? '' : 'lg:col-span-3'}`}><h2 className="mb-2 font-display text-xl font-semibold">Daily adherence</h2><TrendChart days={s.heatmap} /></motion.section>
        <motion.section variants={rise} className={`card p-5 ${compact ? '' : 'lg:col-span-2'}`}><h2 className="mb-3 font-display text-xl font-semibold">Calendar</h2><CalendarHeatmap days={s.heatmap.slice(-Math.min(range, 42))} compact={range > 30} /></motion.section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <motion.section variants={rise} className="card p-5"><h2 className="font-display text-xl font-semibold">When are doses missed?</h2>
          <p className="mb-2 text-sm text-muted">{s.worstSlot ? <>Most missed: <b className="capitalize text-coral">{s.worstSlot}</b></> : 'No missed doses in this period.'}</p><SlotChart stats={s} /></motion.section>
        <motion.section variants={rise} className="card p-5"><h2 className="mb-3 font-display text-xl font-semibold">By medicine</h2><MedicineBars stats={s} /></motion.section>
      </div>
      <motion.section variants={rise} className="card p-5"><h2 className="mb-3 font-display text-xl font-semibold">Refill forecast</h2><StockForecast stats={s} /></motion.section>
      {s.notes.length > 0 && <motion.section variants={rise} className="card p-5"><h2 className="mb-3 font-display text-xl font-semibold">Recent notes</h2><ul className="space-y-2">{s.notes.map((n, i) => <li key={i} className="rounded-xl bg-ink/5 px-3.5 py-2.5 text-[15px]"><b>{n.medicine}</b> · {n.date.slice(0, 10)} <span className="text-muted">— “{n.note}”</span></li>)}</ul></motion.section>}
    </motion.div>
  );
}
