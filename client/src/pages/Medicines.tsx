import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useUI } from '../lib/store';
import { fmtTime } from '../lib/time';
import { rise, stagger } from '../lib/motion';
import type { AllergyFlag, Form, InteractionFlag, Medicine } from '../lib/types';
import { Modal } from '../components/Modal';
import { PillIcon } from '../components/PillIcon';
import { InteractionWarnings } from '../components/InteractionWarnings';
import { EmptyMeds, EmptyState } from '../components/Illustrations';
import { PageSkeleton } from '../components/Skeleton';
import { Magnetic } from '../components/Magnetic';

const FORMS: Form[] = ['tablet', 'capsule', 'syrup', 'injection', 'drops'];
const COLORS = ['#2dd4bf', '#7dd3fc', '#818cf8', '#f472b6', '#fb7185', '#fbbf24', '#f97316', '#34d399'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const maskLabel = (m: string) => (m === 'MTWTFSS' ? 'Every day' : m.split('').map((c, i) => (c === '-' ? '' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i])).filter(Boolean).join(', '));

interface FormState { name: string; dosage: string; form: Form; color: string; instructions: string; stock_count: number; refill_threshold: number; schedules: { time_of_day: string; days_mask: string }[] }
const blank: FormState = { name: '', dosage: '', form: 'tablet', color: '#2dd4bf', instructions: '', stock_count: 30, refill_threshold: 5, schedules: [{ time_of_day: '08:00', days_mask: 'MTWTFSS' }] };

function MedicineForm({ initial, editingId, onDone }: { initial: FormState; editingId: number | null; onDone: () => void }) {
  const qc = useQueryClient(); const { toast } = useUI();
  const [f, setF] = useState(initial); const [flags, setFlags] = useState<{ interactions: InteractionFlag[]; allergies: AllergyFlag[] }>({ interactions: [], allergies: [] }); const [checked, setChecked] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { // live interaction check as the name is typed
    if (editingId || f.name.trim().length < 3) { setFlags({ interactions: [], allergies: [] }); setChecked(false); return; }
    const t = setTimeout(async () => { try { setFlags(await api.post('/medicines/check', { name: f.name })); setChecked(true); } catch { /* */ } }, 400);
    return () => clearTimeout(t);
  }, [f.name]);
  const save = useMutation({
    mutationFn: () => editingId ? api.patch(`/medicines/${editingId}`, f) : api.post<{ warnings: { interactions: InteractionFlag[] } }>('/medicines', f),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['medicines'] }); qc.invalidateQueries({ queryKey: ['today'] }); qc.invalidateQueries({ queryKey: ['stats'] });
      toast({ kind: r?.warnings?.interactions?.length ? 'warn' : 'success', title: editingId ? 'Medicine updated' : `${f.name} added`, body: r?.warnings?.interactions?.length ? 'Interaction warnings were noted. Please review with your doctor.' : undefined }); onDone(); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Could not save'),
  });
  const setSched = (i: number, patch: Partial<FormState['schedules'][0]>) => setF({ ...f, schedules: f.schedules.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="mname">Medicine name</label><input id="mname" className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Metformin" /></div>
        <div><label className="label" htmlFor="mdose">Dosage</label><input id="mdose" className="input" required value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} placeholder="e.g. 500 mg" /></div>
      </div>
      <InteractionWarnings interactions={flags.interactions} allergies={flags.allergies} checked={checked} />
      <div><span className="label">Form</span><div className="flex flex-wrap gap-2">{FORMS.map((fm) => (
        <button type="button" key={fm} onClick={() => setF({ ...f, form: fm })} aria-pressed={f.form === fm} className={`flex min-h-[72px] min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 text-xs font-bold capitalize transition active:scale-95 ${f.form === fm ? 'border-teal/70 bg-teal/12 ring-2 ring-teal/25' : 'border-line/15 bg-surface/50'}`}><PillIcon form={fm} color={f.color} size={34} name={f.name || 'x'} />{fm}</button>))}</div></div>
      <div><span className="label">Colour</span><div className="flex flex-wrap gap-2.5">{COLORS.map((c) => <button type="button" key={c} aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })} className={`h-10 w-10 rounded-full transition active:scale-90 ${f.color === c ? 'ring-[3px] ring-ink/70 ring-offset-2 ring-offset-transparent' : ''}`} style={{ background: c }} />)}</div></div>
      <div>
        <span className="label">Schedule</span>
        <div className="space-y-3">{f.schedules.map((s, i) => (
          <div key={i} className="rounded-2xl border border-line/10 bg-surface/50 p-3">
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-teal" /><input type="time" className="input !w-auto" aria-label="Time" value={s.time_of_day} onChange={(e) => setSched(i, { time_of_day: e.target.value })} required />
              <div className="ml-auto flex gap-1">{DAYS.map((d, di) => { const on = s.days_mask[di] !== '-'; return <button type="button" key={di} aria-label={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][di]} aria-pressed={on} onClick={() => { const arr = s.days_mask.split(''); arr[di] = on ? '-' : 'MTWTFSS'[di]; setSched(i, { days_mask: arr.join('') }); }} className={`h-9 w-9 rounded-xl text-xs font-extrabold transition active:scale-90 ${on ? 'bg-teal text-[#04211d]' : 'bg-ink/8 text-muted'}`}>{d}</button>; })}</div>
              {f.schedules.length > 1 && <button type="button" className="btn-icon !min-h-[40px] !min-w-[40px]" aria-label="Remove time" onClick={() => setF({ ...f, schedules: f.schedules.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>}</div></div>))}</div>
        <button type="button" className="btn-ghost mt-2 !min-h-[44px] !text-sm" onClick={() => setF({ ...f, schedules: [...f.schedules, { time_of_day: '20:00', days_mask: 'MTWTFSS' }] })}><Plus className="h-4 w-4" />Add another time</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="stock">Stock (units)</label><input id="stock" type="number" min={0} className="input" value={f.stock_count} onChange={(e) => setF({ ...f, stock_count: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor="thr">Refill alert at</label><input id="thr" type="number" min={0} className="input" value={f.refill_threshold} onChange={(e) => setF({ ...f, refill_threshold: Number(e.target.value) })} /></div>
        <div className="sm:col-span-3"><label className="label" htmlFor="ins">Instructions (optional)</label><input id="ins" className="input" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="e.g. Take after food" /></div>
      </div>
      {err && <p role="alert" className="rounded-xl bg-coral/12 px-3.5 py-2.5 text-sm font-semibold text-coral">{err}</p>}
      <button className="btn-primary w-full" disabled={save.isPending}>{save.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add medicine'}</button>
    </form>
  );
}

export default function Medicines() {
  const qc = useQueryClient(); const { toast } = useUI();
  const q = useQuery({ queryKey: ['medicines'], queryFn: () => api.get<{ medicines: Medicine[] }>('/medicines') });
  const [modal, setModal] = useState<{ init: FormState; id: number | null } | null>(null);
  const stop = useMutation({ mutationFn: (id: number) => api.del(`/medicines/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['medicines'] }); qc.invalidateQueries({ queryKey: ['today'] }); toast({ kind: 'info', title: 'Medicine stopped', body: 'Past history is kept.' }); } });
  if (q.isLoading) return <PageSkeleton rows={4} />;
  const meds = q.data?.medicines ?? []; const active = meds.filter((m) => m.status === 'active'); const past = meds.filter((m) => m.status !== 'active');
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3"><div><h1 className="h-page">My medicines</h1><p className="text-muted">{active.length} active</p></div>
        <div className="ml-auto"><Magnetic><button className="btn-primary" onClick={() => setModal({ init: blank, id: null })}><Plus className="h-5 w-5" />Add medicine</button></Magnetic></div></div>
      {active.length === 0 ? <EmptyState art={<EmptyMeds />} title="No medicines yet" body="Add your first medicine and its times. Your Today screen will build itself." action={<button className="btn-primary" onClick={() => setModal({ init: blank, id: null })}><Plus className="h-5 w-5" />Add medicine</button>} /> : (
        <motion.ul variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
          {active.map((m) => {
            const dpd = m.schedules.reduce((a, s) => a + [...s.days_mask].filter((c) => c !== '-').length / 7, 0); const days = dpd ? Math.floor(m.stock_count / dpd) : null; const low = m.stock_count <= m.refill_threshold;
            return (
              <motion.li key={m.id} variants={rise} layout className="card card-lift p-5">
                <div className="flex items-start gap-4"><div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl" style={{ background: `radial-gradient(circle at 30% 25%, ${m.color}33, ${m.color}11 70%)` }}><PillIcon form={m.form} color={m.color} size={56} name={m.name} /></div>
                  <div className="min-w-0 flex-1"><h3 className="font-display text-2xl font-semibold leading-tight">{m.name}</h3><p className="font-semibold text-muted">{m.dosage} · <span className="capitalize">{m.form}</span></p>
                    {m.instructions && <p className="mt-1 text-sm text-muted">{m.instructions}</p>}</div>
                  <div className="flex gap-1"><button className="btn-icon !min-h-[44px] !min-w-[44px]" aria-label={`Edit ${m.name}`} onClick={() => setModal({ id: m.id, init: { name: m.name, dosage: m.dosage, form: m.form, color: m.color, instructions: m.instructions, stock_count: m.stock_count, refill_threshold: m.refill_threshold, schedules: m.schedules.map((s) => ({ time_of_day: s.time_of_day, days_mask: s.days_mask })) } })}><Pencil className="h-4 w-4" /></button>
                    <button className="btn-icon !min-h-[44px] !min-w-[44px]" aria-label={`Stop ${m.name}`} onClick={() => { if (confirm(`Stop ${m.name}? Future doses will be removed; history stays.`)) stop.mutate(m.id); }}><Trash2 className="h-4 w-4" /></button></div></div>
                <div className="mt-4 flex flex-wrap gap-2">{m.schedules.map((s) => <span key={s.time_of_day} className="chip bg-teal/12 text-teal"><Clock className="h-3.5 w-3.5" />{fmtTime(s.time_of_day)} · {maskLabel(s.days_mask)}</span>)}</div>
                <div className="mt-4"><div className="mb-1 flex justify-between text-sm font-bold"><span className={low ? 'text-coral' : 'text-muted'}>{m.stock_count} left{low ? ' · refill soon' : ''}</span><span className="text-muted">{days != null ? `~${days} days` : ''}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink/8"><motion.div className={`h-full rounded-full ${low ? 'bg-coral' : 'bg-gradient-to-r from-teal to-mint'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (m.stock_count / Math.max(m.refill_threshold * 4, 20)) * 100)}%` }} transition={{ duration: 0.9 }} /></div></div>
              </motion.li>);
          })}
        </motion.ul>)}
      {past.length > 0 && <div className="mt-8"><h2 className="mb-3 font-display text-xl font-semibold text-muted">Past medicines</h2><ul className="space-y-2">{past.map((m) => <li key={m.id} className="card flex items-center gap-3 p-3 opacity-70"><PillIcon form={m.form} color={m.color} size={34} name={m.name} /><span className="font-bold">{m.name}</span><span className="text-muted">{m.dosage}</span><span className="chip ml-auto bg-ink/10 text-muted capitalize">{m.status}</span></li>)}</ul></div>}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit medicine' : 'Add a medicine'} wide>{modal && <MedicineForm initial={modal.init} editingId={modal.id} onDone={() => setModal(null)} />}</Modal>
    </div>
  );
}
