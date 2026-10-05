import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { Skeleton } from './Skeleton';
import { useState } from 'react';

interface Insight { bullets: string[]; suggestion: string; provider: 'groq' | 'local'; patient: string; patientId: number }

/** AI weekly insight / digest: 3 bullets + one gentle suggestion. */
export function InsightCard({ patientId, title = 'Your week, in short' }: { patientId?: number; title?: string }) {
  const [spin, setSpin] = useState(0);
  const q = useQuery({ queryKey: ['insight', patientId ?? 'me'], queryFn: () => api.get<{ insight: Insight | null }>(`/ai/insight${patientId ? `?patientId=${patientId}` : ''}`), staleTime: 120000 });
  const refresh = async () => { setSpin((s) => s + 1); const r = await api.get<{ insight: Insight | null }>(`/ai/insight?refresh=1${patientId ? `&patientId=${patientId}` : ''}`); q.refetch(); void r; };
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-label="AI weekly insight">
      <div className="pointer-events-none absolute -left-10 -bottom-16 h-44 w-44 rounded-full bg-amber/15 blur-3xl" />
      <div className="relative mb-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal to-mint text-[#04211d]"><Sparkles className="h-[18px] w-[18px]" /></span>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {q.data?.insight && <span className="chip ml-1 bg-ink/8 text-muted">{q.data.insight.provider === 'groq' ? 'Medi · AI' : 'Medi · offline'}</span>}
        <button className="btn-icon ml-auto !min-h-[40px] !min-w-[40px]" aria-label="Refresh insight" onClick={refresh}><motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.6 }}><RefreshCw className="h-4 w-4" /></motion.span></button>
      </div>
      {q.isLoading ? <div className="space-y-2.5"><Skeleton className="h-5 w-11/12" /><Skeleton className="h-5 w-9/12" /><Skeleton className="h-5 w-10/12" /></div>
        : q.data?.insight ? (
          <div className="relative">
            <ul className="space-y-2">{q.data.insight.bullets.map((b, i) => (
              <motion.li key={b} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="flex gap-2.5 text-[16px] leading-snug"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />{b}</motion.li>))}</ul>
            <p className="mt-3 rounded-xl bg-teal/10 px-3.5 py-2.5 text-[15px] font-semibold text-ink/90"><Lightbulb className="mr-2 inline h-4 w-4 -translate-y-px text-amber" />{q.data.insight.suggestion}</p>
          </div>
        ) : <p className="text-muted">Insights appear once there is a little history to look at.</p>}
    </section>
  );
}
