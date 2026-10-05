import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Mail, Send, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useMe } from '../lib/hooks';
import { useUI } from '../lib/store';
import { rise, stagger } from '../lib/motion';
import type { LinkItem } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { EmptyAlerts, EmptyState } from '../components/Illustrations';
import { PageSkeleton } from '../components/Skeleton';

export default function Links() {
  const { data: me } = useMe(); const qc = useQueryClient(); const { toast } = useUI(); const [email, setEmail] = useState('');
  const q = useQuery({ queryKey: ['links'], queryFn: () => api.get<{ links: LinkItem[] }>('/links') });
  const done = () => { qc.invalidateQueries({ queryKey: ['links'] }); qc.invalidateQueries({ queryKey: ['tracker-patients'] }); };
  const invite = useMutation({ mutationFn: () => api.post('/links/invite', { email }), onSuccess: () => { toast({ kind: 'success', title: 'Invitation sent' }); setEmail(''); done(); }, onError: (e) => toast({ kind: 'error', title: e instanceof ApiError ? e.message : 'Could not invite' }) });
  const accept = useMutation({ mutationFn: (id: number) => api.post('/links/accept', { linkId: id }), onSuccess: () => { toast({ kind: 'success', title: 'You are now following this patient' }); done(); } });
  const unlink = useMutation({ mutationFn: (id: number) => api.del(`/links/${id}`), onSuccess: () => { toast({ kind: 'info', title: 'Link removed' }); done(); } });
  const isPatient = me?.role === 'patient'; const links = q.data?.links ?? [];
  if (q.isLoading) return <PageSkeleton rows={2} />;
  return (
    <div>
      <h1 className="h-page mb-1">{isPatient ? 'Family & caregivers' : 'Patients I follow'}</h1>
      <p className="mb-6 text-muted">{isPatient ? 'Trackers can see your schedule and get alerts if you miss a dose. They can never change your medicines.' : 'Accept invitations to follow a loved one.'}</p>
      {isPatient && <form className="card mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
        <div className="flex-1"><label className="label" htmlFor="inv"><Mail className="mr-1 inline h-4 w-4" />Invite a tracker by email</label><input id="inv" type="email" required className="input" placeholder="vatsal@medinex.demo" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn-primary" disabled={invite.isPending}><Send className="h-5 w-5" />Send invite</button></form>}
      {links.length === 0 ? <EmptyState art={<EmptyAlerts size={150} />} title={isPatient ? 'No one is linked yet' : 'No patients yet'} body={isPatient ? 'Invite a family member above.' : 'Ask a patient to invite you with your email.'} /> : (
        <motion.ul variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">{links.map((l) => { const other = isPatient ? l.tracker : l.patient; return (
          <motion.li key={l.id} variants={rise} className="card flex items-center gap-4 p-4">
            <Avatar seed={other.avatar_seed} name={other.name} size={54} />
            <div className="min-w-0 flex-1"><p className="truncate font-display text-xl font-semibold">{other.name}</p><p className="truncate text-sm text-muted">{other.email}</p>
              <span className={`chip mt-1.5 ${l.status === 'active' ? 'bg-leaf/20 text-leaf' : 'bg-amber/20 text-amber'}`}>{l.status === 'active' ? 'Active' : 'Invitation pending'}</span></div>
            <div className="flex flex-col gap-2">
              {!isPatient && l.status === 'pending' && <button className="btn-primary !min-h-[44px] !text-sm" onClick={() => accept.mutate(l.id)}><Check className="h-4 w-4" />Accept</button>}
              {!isPatient && l.status === 'active' && <Link to={`/patients/${l.patient_id}`} className="btn-ghost !min-h-[44px] !text-sm"><Users className="h-4 w-4" />Open</Link>}
              <button className="btn-ghost !min-h-[44px] !text-sm" onClick={() => { if (confirm('Remove this link?')) unlink.mutate(l.id); }} aria-label="Remove link"><UserMinus className="h-4 w-4" /></button></div>
          </motion.li>); })}</motion.ul>)}
    </div>
  );
}
