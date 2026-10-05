import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { fmtDay, fmtStamp } from '../lib/time';
import type { AuditEntry } from '../lib/types';
import { EmptyAlerts, EmptyState } from '../components/Illustrations';
import { Skeleton } from '../components/Skeleton';

const tone = (a: string) => a.includes('missed') || a.includes('rejected') ? 'bg-coral/15 text-coral' : a.includes('approved') || a.includes('taken') || a.includes('created') ? 'bg-leaf/20 text-leaf' : a.startsWith('demo') ? 'bg-amber/20 text-amber' : 'bg-teal/15 text-teal';
const summary = (m: Record<string, unknown>) => Object.entries(m).filter(([, v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');

export default function AuditTrail() {
  const [action, setAction] = useState(''); const [entity, setEntity] = useState(''); const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['audit', action, entity, q], queryFn: () => api.get<{ entries: AuditEntry[]; facets: { actions: string[]; entities: string[] } }>(`/audit?limit=150&action=${encodeURIComponent(action)}&entity=${encodeURIComponent(entity)}&q=${encodeURIComponent(q)}`), refetchInterval: 5000, placeholderData: (p) => p });
  const d = query.data;
  return (
    <div>
      <h1 className="h-page mb-1">Audit trail</h1><p className="mb-6 text-muted">Every dose, decision and change is recorded in the <code className="rounded bg-ink/10 px-1.5">audit_log</code> table.</p>
      <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1"><label className="label" htmlFor="aq">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input id="aq" className="input !pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, medicine…" /></div></div>
        <div><label className="label" htmlFor="aa">Action</label><select id="aa" className="input" value={action} onChange={(e) => setAction(e.target.value)}><option value="">All actions</option>{d?.facets.actions.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><label className="label" htmlFor="ae">Entity</label><select id="ae" className="input" value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">All tables</option>{d?.facets.entities.map((a) => <option key={a}>{a}</option>)}</select></div>
      </div>
      {!d ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : d.entries.length === 0 ? <EmptyState art={<EmptyAlerts size={140} />} title="No matching entries" /> : (
        <ul className="space-y-2"><AnimatePresence initial={false}>{d.entries.map((e) => (
          <motion.li key={e.id} layout initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(45,212,191,.25)' }} animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 0.6 }} className="card flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3.5">
            <span className="w-24 shrink-0 text-sm font-bold text-muted">{fmtDay(e.created_at)}<br /><span className="text-ink">{fmtStamp(e.created_at)}</span></span>
            <span className={`chip ${tone(e.action)}`}>{e.action}</span>
            <span className="min-w-0 flex-1 text-sm"><b>{e.actor_name ?? 'System'}</b>{e.actor_role && <span className="text-muted"> ({e.actor_role})</span>} <span className="text-muted">→ {e.entity}{e.entity_id ? ` #${e.entity_id}` : ''}</span>
              <span className="block truncate text-xs text-muted">{summary(e.meta)}</span></span>
            <span className="text-xs font-bold text-muted">#{e.id}</span>
          </motion.li>))}</AnimatePresence></ul>)}
    </div>
  );
}
