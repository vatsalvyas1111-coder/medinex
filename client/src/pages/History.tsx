import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { api } from '../lib/api';
import { fmtDay, fmtStamp, fmtTime, parseStamp } from '../lib/time';
import type { Dose, HeatDay, PatientBasics, Stats } from '../lib/types';
import { CalendarHeatmap } from '../components/Heatmap';
import { PillIcon } from '../components/PillIcon';
import { Skeleton } from '../components/Skeleton';
import { EmptyAlerts, EmptyState } from '../components/Illustrations';

type H = Dose & { late: boolean };

export function DayEntries({ patientId, date }: { patientId?: number; date: string }) {
  const q = useQuery({ queryKey: ['history', patientId ?? 'me', date], queryFn: () => api.get<{ doses: H[] }>(`/doses/history?from=${date}&to=${date}${patientId ? `&patientId=${patientId}` : ''}`) });
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  const doses = q.data?.doses ?? [];
  if (!doses.length) return <EmptyState art={<EmptyAlerts size={130} />} title="Nothing scheduled" body="No doses were due on this day." />;
  return (
    <ul className="space-y-2.5">
      {doses.map((d, i) => (
        <motion.li key={d.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-surface/60 p-3">
          <PillIcon form={d.form} color={d.color} size={40} name={d.name} />
          <div className="min-w-0 flex-1"><p className="font-bold leading-tight">{d.name} <span className="font-semibold text-muted">{d.dosage}</span></p>
            <p className="text-sm text-muted">Scheduled {fmtTime(d.time)}{d.taken_at ? ` · taken ${fmtStamp(d.taken_at)}` : ''}{d.note ? ` · “${d.note}”` : ''}</p></div>
          <span className={`chip ${d.status === 'taken' ? (d.late ? 'bg-amber/20 text-amber' : 'bg-leaf/20 text-leaf') : d.status === 'missed' ? 'bg-coral/15 text-coral' : 'bg-ink/10 text-muted'}`}>{d.status === 'taken' && d.late ? 'Late' : d.status}</span>
        </motion.li>))}
    </ul>
  );
}

export default function History() {
  const q = useQuery({ queryKey: ['stats', 'me', 90], queryFn: () => api.get<{ patient: PatientBasics; stats: Stats }>('/analytics/adherence?range=90') });
  const [sel, setSel] = useState<HeatDay | null>(null);
  const days = q.data?.stats.heatmap ?? [];
  const selected = sel ?? days.filter((d) => d.total > 0).at(-1) ?? null;
  return (
    <div>
      <h1 className="h-page mb-1">Log history</h1><p className="mb-6 text-muted">Tap any day to see what happened.</p>
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          {q.isLoading ? <Skeleton className="h-96" /> : <CalendarHeatmap days={days.slice(-42)} selected={selected?.date} onSelect={setSel} />}
        </section>
        <section className="card p-5 lg:col-span-2">
          <AnimatePresence mode="wait">
            {selected ? (<motion.div key={selected.date} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h2 className="font-display text-2xl font-semibold">{fmtDay(selected.date)}</h2>
              <p className="mb-3 text-sm text-muted">{selected.total ? `${selected.taken} of ${selected.total} taken${selected.missed ? ` · ${selected.missed} missed` : ''}${selected.late ? ` · ${selected.late} late` : ''}` : 'No doses'}</p>
              <DayEntries date={selected.date} /></motion.div>) : <Skeleton className="h-48" />}
          </AnimatePresence>
        </section>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Showing the last 6 weeks · {parseStamp(days.at(-1)?.date ?? '2000-01-01').toDateString()}</p>
    </div>
  );
}
