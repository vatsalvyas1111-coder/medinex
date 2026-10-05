import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertOctagon, BellRing, CheckCheck, Flame, Inbox, MessageSquare, Package, Phone, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAlerts, useMe } from '../lib/hooks';
import { relative, useNow } from '../lib/time';
import type { PatientSummary } from '../lib/types';
import { EmptyAlerts, EmptyState } from '../components/Illustrations';
import { PageSkeleton } from '../components/Skeleton';

const META: Record<string, { icon: typeof BellRing; cls: string; label: string }> = {
  missed_dose: { icon: AlertOctagon, cls: 'bg-coral/15 text-coral', label: 'Missed dose' }, low_stock: { icon: Package, cls: 'bg-amber/20 text-amber', label: 'Low stock' },
  request_decided: { icon: ShieldCheck, cls: 'bg-leaf/20 text-leaf', label: 'Request decision' }, streak: { icon: Flame, cls: 'bg-amber/20 text-amber', label: 'Streak' },
  new_request: { icon: Inbox, cls: 'bg-teal/15 text-teal', label: 'New request' }, note: { icon: MessageSquare, cls: 'bg-ink/10 text-muted', label: 'Dose note' }, invite: { icon: UserPlus, cls: 'bg-teal/15 text-teal', label: 'Invitation' },
};

export default function Alerts() {
  const { data: me } = useMe(); const qc = useQueryClient(); const now = useNow(30000); const [tab, setTab] = useState<'all' | 'unread'>('all');
  const q = useAlerts();
  const pats = useQuery({ queryKey: ['tracker-patients'], queryFn: () => api.get<{ patients: PatientSummary[] }>('/trackers/patients'), enabled: me?.role === 'tracker' });
  const read = useMutation({ mutationFn: (id: number) => api.patch(`/alerts/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }) });
  const readAll = useMutation({ mutationFn: () => api.post('/alerts/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }) });
  if (q.isLoading) return <PageSkeleton rows={4} />;
  const all = q.data?.alerts ?? []; const list = tab === 'unread' ? all.filter((a) => !a.read) : all;
  const phoneOf = (pid: number) => pats.data?.patients.find((p) => p.patient.id === pid)?.patient.phone;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3"><div><h1 className="h-page">Notifications</h1><p className="text-muted">{q.data?.unread ?? 0} unread</p></div>
        <div className="ml-auto flex items-center gap-2"><div className="glass inline-flex rounded-2xl p-1">{(['all', 'unread'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`relative min-h-[44px] rounded-xl px-5 text-sm font-bold capitalize ${tab === t ? 'text-ink' : 'text-muted'}`}>{tab === t && <motion.span layoutId="alert-tab" className="absolute inset-0 rounded-xl bg-surface shadow-soft" />}<span className="relative">{t}</span></button>)}</div>
          <button className="btn-ghost" onClick={() => readAll.mutate()}><CheckCheck className="h-5 w-5" /><span className="hidden sm:inline">Mark all read</span></button></div></div>
      {list.length === 0 ? <EmptyState art={<EmptyAlerts />} title="All caught up" body="New alerts appear here the moment they happen." /> : (
        <ul className="space-y-3"><AnimatePresence initial={false}>{list.map((a) => { const m = META[a.type] ?? META.note; const phone = a.type === 'missed_dose' && me?.role === 'tracker' ? phoneOf(a.patient_id) : undefined;
          return (
            <motion.li key={a.id} layout initial={{ opacity: 0, y: -14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }} className={`card flex flex-wrap items-center gap-4 p-4 ${a.read ? 'opacity-70' : ''}`}>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${m.cls}`}><m.icon className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1"><p className="text-[16px] font-bold leading-snug">{a.message}</p><p className="mt-0.5 text-sm text-muted">{m.label} · {relative(a.created_at, now)}</p></div>
              <div className="flex flex-wrap gap-2">
                {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="btn-primary !min-h-[44px] !text-sm"><Phone className="h-4 w-4" />Call {a.patient_name.split(' ')[0]}</a>}
                {me?.role === 'tracker' && <Link to={`/patients/${a.patient_id}`} className="btn-ghost !min-h-[44px] !text-sm">View</Link>}
                {me?.role === 'reviewer' && a.type === 'new_request' && <Link to="/queue" className="btn-ghost !min-h-[44px] !text-sm">Review</Link>}
                {!a.read && <button className="btn-ghost !min-h-[44px] !text-sm" onClick={() => read.mutate(a.id)}><CheckCheck className="h-4 w-4" />Mark as reviewed</button>}</div>
            </motion.li>); })}</AnimatePresence></ul>)}
    </div>
  );
}
