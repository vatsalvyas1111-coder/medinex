import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Clock, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useUI } from '../lib/store';
import { fmtTime, parseStamp, pad, relative, useNow } from '../lib/time';
import { rise, stagger } from '../lib/motion';
import type { AllergyFlag, InteractionFlag, Medicine, MedRequest, PatientBasics, Form } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { EmptyRequests, EmptyState } from '../components/Illustrations';
import { InteractionWarnings } from '../components/InteractionWarnings';
import { PillIcon } from '../components/PillIcon';
import { PageSkeleton, Skeleton } from '../components/Skeleton';

interface Detail { request: MedRequest; patient: PatientBasics; currentMedicines: Medicine[]; interactions: InteractionFlag[]; allergies: AllergyFlag[]; notes: { scheduled_for: string; note: string; name: string }[] }
const ageCls = (mins: number) => (mins > 720 ? 'bg-coral/20 text-coral' : mins > 120 ? 'bg-amber/25 text-amber' : 'bg-teal/15 text-teal');
const sevRank = (d: { interactions: InteractionFlag[] }) => (d.interactions.some((i) => i.severity === 'major') ? 'major' : d.interactions.some((i) => i.severity === 'moderate') ? 'moderate' : d.interactions.length ? 'minor' : 'none');

function nextHour(now: Date) { const d = new Date(now.getTime() + 30 * 60000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function RequestDetail({ id }: { id: number }) {
  const qc = useQueryClient(); const { toast, askMedi } = useUI(); const now = useNow(60000);
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api.get<Detail>(`/requests/${id}`) });
  const brief = useQuery({ queryKey: ['brief', id, q.data?.request.status], queryFn: () => api.get<{ brief: { text: string; provider: string } }>(`/ai/brief/${id}`), enabled: !!q.data });
  const [note, setNote] = useState(''); const [times, setTimes] = useState<string[]>([nextHour(now)]); const [form, setForm] = useState<Form>('tablet'); const [dosage, setDosage] = useState(''); const [stock, setStock] = useState(30); const [err, setErr] = useState('');
  useEffect(() => { if (q.data) { setDosage(q.data.request.dosage); setNote(''); setErr(''); setTimes([nextHour(now)]); } }, [q.data?.request.id]);
  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => api.patch(`/requests/${id}/decide`, { decision, note, ...(decision === 'approved' ? { schedule: { times, dosage: dosage || undefined, form, stock_count: stock, days_mask: 'MTWTFSS', instructions: '' } } : {}) }),
    onSuccess: (_r, decision) => { toast({ kind: decision === 'approved' ? 'success' : 'info', title: decision === 'approved' ? 'Approved. It just appeared in the patient’s day.' : 'Request declined', body: 'The patient and their trackers were notified.' }); qc.invalidateQueries(); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Could not save decision'),
  });
  if (q.isLoading || !q.data) return <Skeleton className="h-[520px]" />;
  const d = q.data; const r = d.request; const pending = r.status === 'pending'; const sev = sevRank(d);
  return (
    <motion.div key={id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <section className="card p-5">
        <div className="flex flex-wrap items-start gap-4"><Avatar seed={d.patient.avatar_seed} name={d.patient.name} size={60} ring />
          <div className="min-w-0 flex-1"><h2 className="font-display text-3xl font-semibold leading-tight">{r.name} <span className="text-xl text-muted">{r.dosage || 'dose not given'}</span></h2>
            <p className="text-muted">{d.patient.name}, {d.patient.age} · {relative(r.created_at, now)}</p><p className="mt-2 text-[16px]">“{r.reason}”</p></div>
          {!pending && <span className={`chip ${r.status === 'approved' ? 'bg-leaf/20 text-leaf' : 'bg-coral/15 text-coral'} capitalize`}>{r.status}</span>}</div>
      </section>

      <section className="card p-5" aria-label="AI brief"><div className="mb-2 flex items-center gap-2"><Sparkles className="h-5 w-5 text-teal" /><h3 className="font-display text-xl font-semibold">Medi brief</h3>{brief.data && <span className="chip bg-ink/8 text-muted">{brief.data.brief.provider === 'groq' ? 'AI' : 'offline'}</span>}
        <button className="btn-ghost ml-auto !min-h-[40px] !text-sm" onClick={() => askMedi(`Summarise the ${r.name} request for ${d.patient.name.split(' ')[0]}`)}>Ask Medi</button></div>
        {brief.isLoading ? <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-4/6" /></div> : <p className="leading-relaxed text-ink/90">{brief.data?.brief.text}</p>}
        <p className="mt-2 text-xs text-muted">Neutral summary to assist you. The decision is yours.</p></section>

      <section className="card space-y-3 p-5"><h3 className="font-display text-xl font-semibold">Interaction check</h3>
        <div className="flex flex-wrap gap-2"><span className={`chip ${sev === 'major' ? 'bg-coral/20 text-coral' : sev === 'moderate' ? 'bg-amber/25 text-amber' : sev === 'minor' ? 'bg-ink/10 text-muted' : 'bg-leaf/20 text-leaf'}`}>{d.interactions.length} interaction flag{d.interactions.length === 1 ? '' : 's'} · highest: {sev}</span>{d.allergies.length > 0 && <span className="chip bg-coral/20 text-coral">Allergy match</span>}</div>
        <InteractionWarnings interactions={d.interactions} allergies={d.allergies} checked /></section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5"><h3 className="mb-2 font-display text-xl font-semibold">Patient</h3><dl className="space-y-1.5 text-[15px]"><div><dt className="inline font-bold">Conditions: </dt><dd className="inline text-muted">{d.patient.conditions || '—'}</dd></div><div><dt className="inline font-bold">Allergies: </dt><dd className="inline font-semibold text-coral">{d.patient.allergies || 'none listed'}</dd></div></dl>
          {d.notes.length > 0 && <div className="mt-3"><p className="text-sm font-bold">Recent dose notes</p>{d.notes.map((n, i) => <p key={i} className="text-sm text-muted">• {n.name}: “{n.note}”</p>)}</div>}</div>
        <div className="card p-5"><h3 className="mb-2 font-display text-xl font-semibold">Current medicines ({d.currentMedicines.length})</h3><ul className="space-y-1.5">{d.currentMedicines.map((m) => <li key={m.id} className="flex items-center gap-2.5"><PillIcon form={m.form} color={m.color} size={28} name={m.name} /><span className="text-[15px]"><b>{m.name}</b> <span className="text-muted">{m.dosage} · {m.schedules.map((s) => fmtTime(s.time_of_day)).join(', ')}</span></span></li>)}</ul></div>
      </section>

      {pending ? (
        <section className="card space-y-4 p-5" aria-label="Decision"><h3 className="font-display text-xl font-semibold">Your decision</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="dz">Confirm dose</label><input id="dz" className="input" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 40 mg" /></div>
            <div><label className="label" htmlFor="fm">Form</label><select id="fm" className="input" value={form} onChange={(e) => setForm(e.target.value as Form)}>{['tablet', 'capsule', 'syrup', 'injection', 'drops'].map((f) => <option key={f}>{f}</option>)}</select></div>
            <div><label className="label" htmlFor="sk">Supply (units)</label><input id="sk" type="number" min={0} className="input" value={stock} onChange={(e) => setStock(Number(e.target.value))} /></div></div>
          <div><span className="label">Daily schedule (if approved)</span><div className="flex flex-wrap items-center gap-2">{times.map((t, i) => <span key={i} className="flex items-center gap-1"><Clock className="h-4 w-4 text-teal" /><input type="time" className="input !w-auto" value={t} aria-label={`Time ${i + 1}`} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />{times.length > 1 && <button className="btn-icon !min-h-[40px] !min-w-[40px]" aria-label="Remove time" onClick={() => setTimes(times.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>}</span>)}
            <button className="btn-ghost !min-h-[44px] !text-sm" onClick={() => setTimes([...times, '20:00'])}><Plus className="h-4 w-4" />Add time</button></div></div>
          <div><label className="label" htmlFor="rn">Note {`(required to reject)`}</label><textarea id="rn" rows={3} className="input !py-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Instructions for the patient, or the reason for declining" /></div>
          {err && <p role="alert" className="rounded-xl bg-coral/12 px-3.5 py-2.5 text-sm font-semibold text-coral">{err}</p>}
          <div className="flex flex-col gap-3 sm:flex-row"><button className="btn-primary flex-1" disabled={decide.isPending || times.some((t) => !t)} onClick={() => decide.mutate('approved')}><Check className="h-5 w-5" />Approve & add to schedule</button>
            <button className="btn-danger flex-1" disabled={decide.isPending} onClick={() => { if (note.trim().length < 3) { setErr('Please add a note explaining why this is being declined.'); return; } decide.mutate('rejected'); }}><X className="h-5 w-5" />Reject</button></div></section>
      ) : (<section className="card p-5"><p className="font-semibold">{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.reviewer_name} · {r.decided_at ? relative(r.decided_at, now) : ''}</p>{r.reviewer_note && <p className="mt-1 text-muted">“{r.reviewer_note}”</p>}</section>)}
    </motion.div>
  );
}

export default function ReviewerQueue() {
  const { id } = useParams(); const nav = useNavigate(); const now = useNow(60000); const [tab, setTab] = useState<'pending' | 'decided'>('pending');
  const q = useQuery({ queryKey: ['requests'], queryFn: () => api.get<{ requests: MedRequest[] }>('/requests') });
  const all = q.data?.requests ?? []; const pending = all.filter((r) => r.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at)); const decided = all.filter((r) => r.status !== 'pending');
  const list = tab === 'pending' ? pending : decided;
  const selectedId = id ? Number(id) : null;
  useEffect(() => { if (!selectedId && list[0] && window.innerWidth >= 1024) nav(`/queue/${list[0].id}`, { replace: true }); }, [q.data, tab]);
  if (q.isLoading) return <PageSkeleton rows={3} />;
  return (
    <div>
      <h1 className="h-page mb-1">Review queue</h1><p className="mb-6 text-muted">{pending.length} request{pending.length === 1 ? '' : 's'} waiting for you.</p>
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className={`${selectedId ? 'hidden lg:block' : ''}`}>
          <div className="glass mb-3 inline-flex rounded-2xl p-1">{(['pending', 'decided'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`relative min-h-[44px] rounded-xl px-5 text-sm font-bold capitalize ${tab === t ? 'text-ink' : 'text-muted'}`}>{tab === t && <motion.span layoutId="q-tab" className="absolute inset-0 rounded-xl bg-surface shadow-soft" />}<span className="relative">{t} ({t === 'pending' ? pending.length : decided.length})</span></button>)}</div>
          {list.length === 0 ? <EmptyState art={<EmptyRequests size={140} />} title={tab === 'pending' ? 'Queue is clear' : 'Nothing decided yet'} body={tab === 'pending' ? 'New requests appear here live.' : undefined} /> : (
            <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-2.5">{list.map((r) => { const mins = Math.round((now.getTime() - parseStamp(r.created_at).getTime()) / 60000); const active = selectedId === r.id;
              return (<motion.li key={r.id} variants={rise} layout><button onClick={() => nav(`/queue/${r.id}`)} className={`card card-lift flex w-full items-center gap-3 p-3.5 text-left ${active ? '!border-teal/60 ring-2 ring-teal/30' : ''}`}>
                <div className="min-w-0 flex-1"><p className="font-display text-lg font-semibold leading-tight">{r.name} <span className="text-sm font-semibold text-muted">{r.dosage}</span></p><p className="truncate text-sm text-muted">{r.patient_name}</p></div>
                <span className={`chip ${r.status === 'pending' ? ageCls(mins) : r.status === 'approved' ? 'bg-leaf/20 text-leaf' : 'bg-coral/15 text-coral'}`}>{r.status === 'pending' ? relative(r.created_at, now).replace(' ago', '') : r.status}</span><ChevronRight className="h-4 w-4 text-muted" /></button></motion.li>); })}</motion.ul>)}
        </aside>
        <div className={`${selectedId ? '' : 'hidden lg:block'}`}>
          {selectedId ? (<><button className="btn-ghost mb-3 lg:hidden" onClick={() => nav('/queue')}>← Back to queue</button><RequestDetail id={selectedId} /></>) : <div className="card hidden p-10 text-center text-muted lg:block">Select a request to review it.</div>}
        </div>
      </div>
    </div>
  );
}
