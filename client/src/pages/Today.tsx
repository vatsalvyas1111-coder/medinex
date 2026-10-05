import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Moon, Sparkles, Sun, Sunrise, Sunset, Timer, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useMe } from '../lib/hooks';
import { useUI } from '../lib/store';
import { fmtLong, greeting, parseStamp, useClockStore, useNow, countdown, SLOT_LABEL } from '../lib/time';
import { stagger, rise } from '../lib/motion';
import type { Dose, Slot, TodayResponse } from '../lib/types';
import { DoseCard } from '../components/DoseCard';
import { ParticleField, ParticleHandle } from '../components/ParticleField';
import { CountUp, Ring } from '../components/Ring';
import { EmptyMeds, EmptyState } from '../components/Illustrations';
import { PageSkeleton } from '../components/Skeleton';
import { InsightCard } from '../components/InsightCard';
import { Link } from 'react-router-dom';

const SLOT_ICON = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon } as const;
const SLOTS: Slot[] = ['morning', 'afternoon', 'evening', 'night'];

export default function Today() {
  const qc = useQueryClient(); const { data: me } = useMe(); const { toast, setCelebrate, celebrate } = useUI();
  const now = useNow(1000);
  const burst = useRef<ParticleHandle>(null);
  const { data, isLoading } = useQuery({ queryKey: ['today'], queryFn: () => api.get<TodayResponse>('/doses/today') });
  const [shake, setShake] = useState<number | null>(null);
  const [ringShake, setRingShake] = useState(false);
  const known = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => { if (data?.now) useClockStore.getState().sync(data.now); }, [data?.now]);
  // detect doses that appear live (e.g. a reviewer approval) so they can enter with a flourish
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.doses.map((d) => d.id));
    if (known.current) { const added = [...ids].filter((i) => !known.current!.has(i)); if (added.length) { setFresh(new Set(added)); setTimeout(() => setFresh(new Set()), 6000); } }
    known.current = ids;
  }, [data]);

  const patch = (fn: (t: TodayResponse) => TodayResponse) => qc.setQueryData<TodayResponse>(['today'], (t) => (t ? fn(t) : t));

  const take = useMutation({
    mutationFn: (d: Dose) => api.post<{ dose: Dose; allDone: boolean; streak: { current: number; longest: number } }>(`/doses/${d.id}/take`),
    onMutate: async (d) => { // optimistic: card animates immediately
      await qc.cancelQueries({ queryKey: ['today'] });
      const before = qc.getQueryData<TodayResponse>(['today']);
      patch((t) => ({ ...t, doses: t.doses.map((x) => (x.id === d.id ? { ...x, status: 'taken', state: 'taken', taken_at: t.now.slice(0, 11) + `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00` } : x)),
        progress: { ...t.progress, taken: t.progress.taken + 1 } }));
      return { before };
    },
    onError: (e, d, ctx) => {
      if (ctx?.before) qc.setQueryData(['today'], ctx.before);
      setShake(d.id); setTimeout(() => setShake(null), 500);
      toast({ kind: 'error', title: 'Could not log that dose', body: e instanceof ApiError ? e.message : 'Please try again.' });
    },
    onSuccess: (res) => {
      patch((t) => ({ ...t, doses: t.doses.map((x) => (x.id === res.dose.id ? res.dose : x)), streak: res.streak }));
      if (res.allDone) { setTimeout(() => { setRingShake(true); setTimeout(() => setRingShake(false), 600); }, 900); setTimeout(() => setCelebrate(true), 1500); }
      qc.invalidateQueries({ queryKey: ['stats'] }); qc.invalidateQueries({ queryKey: ['history'] });
    },
  });

  const undo = useMutation({
    mutationFn: (d: Dose) => api.post<{ dose: Dose }>(`/doses/${d.id}/undo`),
    onMutate: async (d) => { const before = qc.getQueryData<TodayResponse>(['today']); patch((t) => ({ ...t, doses: t.doses.map((x) => (x.id === d.id ? { ...x, status: 'pending', state: 'due', taken_at: null } : x)), progress: { ...t.progress, taken: Math.max(0, t.progress.taken - 1) } })); return { before }; },
    onError: (e, _d, ctx) => { if (ctx?.before) qc.setQueryData(['today'], ctx.before); toast({ kind: 'error', title: 'Could not undo', body: e instanceof ApiError ? e.message : undefined }); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['today'] }); qc.invalidateQueries({ queryKey: ['stats'] }); },
  });

  const doTake = useCallback((d: Dose, x: number, y: number) => {
    if (d.status === 'taken' || take.isPending) return;
    burst.current?.burst(x, y, { count: 12 + Math.floor(Math.random() * 9), colors: [d.color, '#ffffff', '#86efac', d.color] });
    take.mutate(d);
  }, [take]);
  const askUndo = useCallback((d: Dose) => {
    toast({ kind: 'info', title: `Undo ${d.name}?`, body: 'This will mark the dose as not taken and restore one to your stock.', duration: 6500, action: { label: 'Undo', onClick: () => undo.mutate(d) } });
  }, [undo]);
  const note = useMutation({ mutationFn: ({ d, text }: { d: Dose; text: string }) => api.patch(`/doses/${d.id}/note`, { note: text }), onSuccess: () => { toast({ kind: 'success', title: 'Note saved', body: 'Your family will see it.' }); qc.invalidateQueries({ queryKey: ['today'] }); } });

  // Space = take next dose
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement; if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) || el.isContentEditable || useUI.getState().mediOpen || useUI.getState().paletteOpen) return;
      const t = qc.getQueryData<TodayResponse>(['today']); const nextDose = t?.doses.find((d) => d.status !== 'taken' && (d.state === 'due' || d.state === 'overdue')) ?? t?.doses.find((d) => d.status === 'pending');
      if (nextDose) { e.preventDefault(); doTake(nextDose, window.innerWidth / 2, window.innerHeight / 3); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [doTake]);

  if (isLoading || !data) return <PageSkeleton rows={4} ring />;
  const { doses, progress, streak } = data;
  const pct = progress.total ? progress.taken / progress.total : 0;
  const upcoming = doses.filter((d) => d.status === 'pending' && parseStamp(d.scheduled_for).getTime() > now.getTime()).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0];
  const nextMins = upcoming ? Math.max(0, Math.ceil((parseStamp(upcoming.scheduled_for).getTime() - now.getTime()) / 60000)) : 0;
  const overdue = doses.filter((d) => d.state === 'overdue' && d.status === 'pending');
  const first = me?.name.split(' ')[0];

  return (
    <div>
      <div className="pointer-events-none fixed inset-0 z-[70]"><ParticleField ref={burst} mode="burst" count={160} /></div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">
        <motion.header variants={rise}>
          <p className="text-[15px] font-semibold text-muted">{fmtLong(now)}</p>
          <h1 className="h-page mt-1">{greeting(now)}, <span className="gradient-text">{first}</span></h1>
        </motion.header>

        <motion.section variants={rise} className="card relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
            <Ring value={pct} size={188} stroke={16} shake={ringShake}>
              <div className="font-display text-5xl font-semibold leading-none"><CountUp value={progress.taken} /><span className="text-2xl text-muted">/{progress.total}</span></div>
              <div className="mt-1.5 text-sm font-bold text-muted">{progress.total ? `${progress.taken} of ${progress.total} taken` : 'Nothing due'}</div>
            </Ring>
            <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line/10 bg-surface/50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-muted"><Timer className="h-4 w-4" /> Next dose</div>
                {upcoming ? (<><p className="mt-1.5 font-display text-2xl font-semibold leading-tight">{upcoming.name}</p><p className="text-lg font-bold text-teal">in {countdown(nextMins)}</p></>)
                  : progress.total && progress.taken === progress.total ? <p className="mt-1.5 font-display text-xl font-semibold">All done for today</p>
                  : <p className="mt-1.5 font-display text-xl font-semibold">{overdue.length ? `${overdue.length} overdue` : 'Nothing coming up'}</p>}
              </div>
              <div className="rounded-2xl border border-line/10 bg-surface/50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-muted"><Flame className="h-4 w-4 text-amber" /> Streak</div>
                <div className="mt-1.5 flex items-center gap-3">
                  <motion.span animate={{ scale: [1, 1.14, 1], rotate: [0, -4, 3, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="drop-shadow-[0_4px_12px_rgba(251,146,60,.55)]"><Flame className="h-9 w-9 fill-amber/80 text-amber" /></motion.span>
                  <div><p className="font-display text-3xl font-semibold leading-none"><CountUp value={streak.current} /> <span className="text-base font-bold text-muted">day{streak.current === 1 ? '' : 's'}</span></p><p className="text-sm text-muted">best {streak.longest}</p></div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div variants={rise}><InsightCard /></motion.div>

        {doses.length === 0 ? (
          <EmptyState art={<EmptyMeds />} title="No doses scheduled today" body="Add a medicine with a schedule and it will appear here." action={<Link to="/medicines" className="btn-primary">Add a medicine</Link>} />
        ) : (
          <div className="space-y-8">
            {SLOTS.map((slot) => {
              const list = doses.filter((d) => d.slot === slot); if (!list.length) return null;
              const Icon = SLOT_ICON[slot]; const done = list.filter((d) => d.status === 'taken').length;
              return (
                <motion.section key={slot} variants={rise} aria-label={SLOT_LABEL[slot]}>
                  <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface/70 ring-1 ring-line/10"><Icon className="h-5 w-5 text-teal" /></span>
                    <h2 className="font-display text-2xl font-semibold">{SLOT_LABEL[slot]}</h2><span className="ml-auto text-sm font-bold text-muted">{done}/{list.length}</span></div>
                  <div className="relative space-y-3 pl-0 sm:pl-5">
                    <span className="absolute bottom-3 left-[18px] top-3 hidden w-px bg-gradient-to-b from-teal/40 via-line/10 to-transparent sm:block" />
                    <AnimatePresence initial={false}>
                      {list.map((d, i) => <DoseCard key={d.id} dose={d} index={i} isNew={fresh.has(d.id)} shaking={shake === d.id} onTake={doTake} onUndo={askUndo} onNote={(dd, text) => note.mutate({ d: dd, text })} />)}
                    </AnimatePresence>
                  </div>
                </motion.section>
              );
            })}
            <p className="hidden items-center justify-center gap-2 text-sm text-muted sm:flex"><Keyboard className="h-4 w-4" /> Press <kbd className="rounded-md border border-line/20 bg-surface/70 px-2 py-0.5 font-bold">Space</kbd> to take your next dose</p>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {celebrate && (
          <motion.div className="fixed inset-0 z-[75] grid cursor-pointer place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} onClick={() => setCelebrate(false)} role="dialog" aria-label="All done today">
            <div className="absolute inset-0 bg-[rgb(var(--bg))]/75 backdrop-blur-md" />
            <div className="absolute inset-0"><ParticleField mode="celebrate" count={120} color={['#5eead4', '#fde68a', '#a7f3d0', '#f9a8d4', '#fff']} additive={false} speed={0.8} /></div>
            <motion.div className="relative px-6 text-center" initial={{ scale: 0.85, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}>
              <motion.div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-teal to-mint shadow-glow" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }}><Sparkles className="h-11 w-11 text-[#04211d]" /></motion.div>
              <h2 className="font-display text-5xl font-semibold sm:text-6xl">All done today</h2>
              <p className="mx-auto mt-3 max-w-md text-xl text-muted">Every dose logged, {first}. Your family can rest easy.</p>
              <p className="mt-6 text-sm font-semibold text-muted/80">Tap anywhere to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
