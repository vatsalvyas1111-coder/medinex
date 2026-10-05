import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Send, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useUI } from '../lib/store';
import { relative, useNow } from '../lib/time';
import { rise, stagger } from '../lib/motion';
import type { AllergyFlag, InteractionFlag, MedRequest } from '../lib/types';
import { EmptyRequests, EmptyState } from '../components/Illustrations';
import { InteractionWarnings } from '../components/InteractionWarnings';
import { PageSkeleton } from '../components/Skeleton';

const STATUS = { pending: { icon: Clock, cls: 'bg-amber/20 text-amber', label: 'Waiting for review' }, approved: { icon: CheckCircle2, cls: 'bg-leaf/20 text-leaf', label: 'Approved' }, rejected: { icon: XCircle, cls: 'bg-coral/15 text-coral', label: 'Not approved' } } as const;

export default function Requests() {
  const qc = useQueryClient(); const { toast } = useUI(); const now = useNow(30000);
  const q = useQuery({ queryKey: ['requests'], queryFn: () => api.get<{ requests: MedRequest[] }>('/requests') });
  const [f, setF] = useState({ name: '', dosage: '', reason: '' }); const [plain, setPlain] = useState(''); const [questions, setQuestions] = useState<string[]>([]);
  const [flags, setFlags] = useState<{ interactions: InteractionFlag[]; allergies: AllergyFlag[] }>({ interactions: [], allergies: [] });
  useEffect(() => { if (f.name.trim().length < 3) { setFlags({ interactions: [], allergies: [] }); return; } const t = setTimeout(async () => { try { setFlags(await api.post('/medicines/check', { name: f.name })); } catch { /* */ } }, 400); return () => clearTimeout(t); }, [f.name]);
  const draft = useMutation({ mutationFn: () => api.post<{ draft: { reason: string; questions: string[]; provider: string } }>('/ai/draft-request', { text: plain }),
    onSuccess: ({ draft: d }) => { setF((s) => ({ ...s, reason: d.reason })); setQuestions(d.questions); toast({ kind: 'info', title: 'Draft ready', body: 'Please add the medicine name and dose yourself, then check the wording.', duration: 5000 }); },
    onError: (e) => toast({ kind: 'error', title: e instanceof ApiError ? e.message : 'Could not draft' }) });
  const submit = useMutation({ mutationFn: () => api.post('/requests', f), onSuccess: () => { toast({ kind: 'success', title: 'Request sent', body: 'A reviewer will look at it soon.' }); setF({ name: '', dosage: '', reason: '' }); setPlain(''); setQuestions([]); qc.invalidateQueries({ queryKey: ['requests'] }); },
    onError: (e) => toast({ kind: 'error', title: e instanceof ApiError ? e.message : 'Could not send' }) });
  const list = q.data?.requests ?? [];
  return (
    <div>
      <h1 className="h-page mb-1">Medicine requests</h1><p className="mb-6 text-muted">Need something new? A doctor or pharmacist reviews every request before it is added.</p>
      <div className="grid gap-6 lg:grid-cols-5">
        <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="card space-y-4 p-5 lg:col-span-3">
          <h2 className="font-display text-2xl font-semibold">New request</h2>
          <div className="rounded-2xl border border-teal/25 bg-teal/8 p-4">
            <label className="label !text-teal" htmlFor="plain"><Sparkles className="mr-1 inline h-4 w-4" />Not sure how to say it? Tell Medi in your own words.</label>
            <div className="flex flex-col gap-2 sm:flex-row"><input id="plain" className="input" placeholder="e.g. my knee hurts at night" value={plain} onChange={(e) => setPlain(e.target.value)} />
              <button type="button" className="btn-primary shrink-0" disabled={plain.trim().length < 3 || draft.isPending} onClick={() => draft.mutate()}>{draft.isPending ? 'Drafting…' : 'Draft with Medi'}</button></div>
            {questions.length > 0 && <ul className="mt-3 space-y-1 text-sm text-muted">{questions.map((x) => <li key={x}>• The doctor may ask: {x}</li>)}</ul>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="rn">Medicine name</label><input id="rn" className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Confirm the name" /></div>
            <div><label className="label" htmlFor="rd">Dose (if known)</label><input id="rd" className="input" value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} placeholder="e.g. 400 mg" /></div>
          </div>
          <InteractionWarnings interactions={flags.interactions} allergies={flags.allergies} />
          <div><label className="label" htmlFor="rr">Why do you need it?</label><textarea id="rr" className="input !py-3" rows={4} required minLength={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <button className="btn-primary w-full" disabled={submit.isPending}><Send className="h-5 w-5" />{submit.isPending ? 'Sending…' : 'Send for review'}</button>
        </motion.form>

        <section className="lg:col-span-2">
          <h2 className="mb-3 font-display text-2xl font-semibold">Your requests</h2>
          {q.isLoading ? <PageSkeleton rows={2} /> : list.length === 0 ? <EmptyState art={<EmptyRequests size={150} />} title="No requests yet" body="Your requests and their answers will show up here." /> : (
            <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-3">{list.map((r) => { const S = STATUS[r.status]; return (
              <motion.li key={r.id} variants={rise} layout className="card p-4">
                <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="font-display text-xl font-semibold leading-tight">{r.name} <span className="text-base font-semibold text-muted">{r.dosage}</span></p><p className="mt-0.5 text-sm text-muted">{relative(r.created_at, now)}</p></div>
                  <span className={`chip ${S.cls}`}><S.icon className="h-3.5 w-3.5" />{S.label}</span></div>
                <p className="mt-2 text-[15px] text-muted">“{r.reason}”</p>
                {r.reviewer_note && <p className="mt-2 rounded-xl bg-ink/5 px-3 py-2 text-sm"><b>{r.reviewer_name}:</b> {r.reviewer_note}</p>}
              </motion.li>); })}</motion.ul>)}
        </section>
      </div>
    </div>
  );
}
