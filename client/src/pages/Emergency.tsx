import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, HeartPulse, Pencil, Phone, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useUI } from '../lib/store';
import { fmtTime } from '../lib/time';
import type { Medicine, PatientBasics } from '../lib/types';
import { PageSkeleton } from '../components/Skeleton';
import { PillIcon } from '../components/PillIcon';
import { Avatar } from '../components/Avatar';

export default function Emergency() {
  const qc = useQueryClient(); const { toast } = useUI();
  const p = useQuery({ queryKey: ['profile'], queryFn: () => api.get<{ profile: PatientBasics }>('/patients/me/profile') });
  const m = useQuery({ queryKey: ['medicines'], queryFn: () => api.get<{ medicines: Medicine[] }>('/medicines') });
  const [edit, setEdit] = useState(false); const [f, setF] = useState({ allergies: '', conditions: '', emergency_contact: '', phone: '' }); const [svg, setSvg] = useState('');
  const profile = p.data?.profile; const meds = (m.data?.medicines ?? []).filter((x) => x.status === 'active');
  useEffect(() => { if (profile) setF({ allergies: profile.allergies, conditions: profile.conditions, emergency_contact: profile.emergency_contact, phone: profile.phone }); }, [profile]);
  useEffect(() => {
    if (!profile) return;
    const text = [`MEDINEX EMERGENCY CARD`, `Name: ${profile.name}${profile.age ? ` (${profile.age})` : ''}`, `Allergies: ${profile.allergies || 'None listed'}`, `Conditions: ${profile.conditions || 'None listed'}`, `Contact: ${profile.emergency_contact || '—'}`, `Medicines: ${meds.map((x) => `${x.name} ${x.dosage}`).join('; ') || 'None'}`].join('\n');
    QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#0B1020', light: '#ffffff' }, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [profile, m.data]);
  const save = useMutation({ mutationFn: () => api.patch('/patients/me/profile', f), onSuccess: () => { setEdit(false); qc.invalidateQueries({ queryKey: ['profile'] }); toast({ kind: 'success', title: 'Emergency card updated' }); } });
  if (!profile) return <PageSkeleton rows={3} />;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3"><div><h1 className="h-page">Emergency card</h1><p className="text-muted">Show this to a paramedic or doctor. Scanning the code lists everything below.</p></div>
        <div className="ml-auto flex gap-2 no-print"><button className="btn-ghost" onClick={() => setEdit((e) => !e)}>{edit ? <Check className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}{edit ? 'Done' : 'Edit'}</button><button className="btn-ghost" onClick={() => window.print()}><Printer className="h-5 w-5" />Print</button></div></div>
      <motion.div initial={{ opacity: 0, y: 20, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} className="card relative overflow-hidden p-0">
        <div className="flex items-center gap-4 bg-gradient-to-r from-coral to-amber p-5 text-white"><HeartPulse className="h-9 w-9" /><div><p className="text-xs font-bold uppercase tracking-[.2em] opacity-90">In case of emergency</p><h2 className="font-display text-3xl font-semibold">{profile.name}{profile.age ? `, ${profile.age}` : ''}</h2></div><Avatar seed={profile.avatar_seed} name={profile.name} size={56} className="ml-auto" /></div>
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto]">
          <div className="space-y-5">
            {edit ? (<form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
              {(['allergies', 'conditions', 'emergency_contact', 'phone'] as const).map((k) => <div key={k}><label className="label capitalize" htmlFor={k}>{k.replace('_', ' ')}</label><input id={k} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
              <button className="btn-primary">Save</button></form>) : (<>
              <div><p className="label">Allergies</p><p className="text-xl font-bold text-coral">{profile.allergies || 'None listed'}</p></div>
              <div><p className="label">Conditions</p><p className="text-lg font-semibold">{profile.conditions || 'None listed'}</p></div>
              <div><p className="label">Emergency contact</p><p className="flex items-center gap-2 text-lg font-semibold"><Phone className="h-5 w-5 text-teal" />{profile.emergency_contact || '—'}</p></div></>)}
            <div><p className="label">Current medicines</p><ul className="grid gap-2 sm:grid-cols-2">{meds.map((x) => <li key={x.id} className="flex items-center gap-2.5 rounded-xl bg-ink/5 p-2.5"><PillIcon form={x.form} color={x.color} size={30} name={x.name} /><span className="min-w-0"><b>{x.name}</b> <span className="text-muted">{x.dosage}</span><span className="block text-xs text-muted">{x.schedules.map((s) => fmtTime(s.time_of_day)).join(' · ')}</span></span></li>)}</ul></div>
          </div>
          <div className="flex flex-col items-center gap-2 md:pt-2"><div className="w-44 overflow-hidden rounded-2xl bg-white p-2 shadow-soft sm:w-52" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code with emergency information" role="img" /><p className="text-xs font-bold text-muted">Scan for details</p></div>
        </div>
      </motion.div>
    </div>
  );
}
