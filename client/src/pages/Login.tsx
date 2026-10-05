import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, HeartHandshake, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { homeFor } from '../lib/hooks';
import { stagger, rise, spring } from '../lib/motion';
import type { Role, User } from '../lib/types';
import { HeroLink } from '../components/Illustrations';
import { Wordmark } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { Magnetic } from '../components/Magnetic';
import { DEMO_ACCOUNTS } from '../lib/mockBackend';

const ROLE_INFO: Record<Role, { label: string; blurb: string; icon: typeof UserRound }> = {
  patient: { label: 'Patient', blurb: 'Log doses in one tap', icon: UserRound },
  tracker: { label: 'Tracker', blurb: 'Watch over a loved one', icon: HeartHandshake },
  reviewer: { label: 'Reviewer', blurb: 'Doctor or pharmacist', icon: Stethoscope },
};

export default function Login() {
  const qc = useQueryClient(); const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'patient' as Role, dob: '' });
  const [error, setError] = useState('');
  const { data: demo } = useQuery({
    queryKey: ['demo-state'],
    queryFn: () => api.get<{ accounts: (User & { role: Role })[] }>('/demo/state'),
    initialData: { accounts: DEMO_ACCOUNTS },
    retry: false
  });
  const done = ({ user }: { user: User }) => { qc.clear(); qc.setQueryData(['me'], user); nav(homeFor(user.role), { replace: true }); };
  const auth = useMutation({
    mutationFn: () => mode === 'login' ? api.post<{ user: User }>('/auth/login', { email: f.email, password: f.password }) : api.post<{ user: User }>('/auth/register', { name: f.name, email: f.email, password: f.password, role: f.role, dob: f.role === 'patient' && f.dob ? f.dob : undefined }),
    onSuccess: done, onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong'),
  });
  const demoLogin = useMutation({
    mutationFn: (role: Role) => api.post<{ user: User }>('/demo/switch-role', { role }),
    onSuccess: done, onError: (e) => setError(e instanceof ApiError ? e.message : 'Demo login failed')
  });

  return (
    <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_1fr]">
      <motion.div variants={stagger} initial="hidden" animate="show" className="order-2 lg:order-1">
        <motion.div variants={rise}><Wordmark size={24} /></motion.div>
        <motion.h1 variants={rise} className="mt-8 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">Never miss <br /><span className="gradient-text">a dose.</span></motion.h1>
        <motion.p variants={rise} className="mt-4 max-w-md text-lg text-muted">One tap for the patient. Live peace of mind for the family. A calm second opinion for the doctor. All in one place.</motion.p>
        <motion.div variants={rise} className="mt-4 max-w-md"><HeroLink className="w-full" /></motion.div>
        <motion.ul variants={rise} className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted">
          <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal" />Role-based access</li><li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal" />Encrypted passwords</li><li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal" />AI that never diagnoses</li>
        </motion.ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.15 }} className="order-1 space-y-5 lg:order-2">
        <div className="card p-6 sm:p-7">
          <div className="relative mb-6 grid grid-cols-2 rounded-2xl bg-ink/6 p-1" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(''); }} className={`relative min-h-[46px] rounded-xl font-bold ${mode === m ? 'text-ink' : 'text-muted'}`}>
                {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={spring} />}<span className="relative">{m === 'login' ? 'Sign in' : 'Create account'}</span></button>))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setError(''); auth.mutate(); }} className="space-y-4">
            {mode === 'register' && (<>
              <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
              <div><span className="label">I am a…</span><div className="grid grid-cols-3 gap-2">{(Object.keys(ROLE_INFO) as Role[]).map((r) => { const I = ROLE_INFO[r].icon; return (
                <button type="button" key={r} onClick={() => setF({ ...f, role: r })} aria-pressed={f.role === r} className={`flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition active:scale-95 ${f.role === r ? 'border-teal/70 bg-teal/12 ring-2 ring-teal/25' : 'border-line/15 bg-surface/50'}`}><I className={`h-5 w-5 ${f.role === r ? 'text-teal' : 'text-muted'}`} /><span className="text-sm font-bold">{ROLE_INFO[r].label}</span></button>); })}</div></div>
              {f.role === 'patient' && <div><label className="label" htmlFor="dob">Date of birth</label><input id="dob" type="date" className="input" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></div>}
            </>)}
            <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></div>
            <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" className="input" required minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {mode === 'register' && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}</div>
            {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-xl bg-coral/12 px-3.5 py-2.5 text-sm font-semibold text-coral">{error}</motion.p>}
            <Magnetic className="w-full"><button className="btn-primary w-full" type="submit" disabled={auth.isPending}>{auth.isPending ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create my account'}<ArrowRight className="h-5 w-5" /></button></Magnetic>
          </form>
        </div>

        <div>
          <p className="mb-2.5 px-1 text-sm font-bold text-muted">Or try the demo. One click, no password.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['patient', 'tracker', 'reviewer'] as Role[]).map((r, i) => { const a = demo?.accounts?.find((x) => x.role === r) || DEMO_ACCOUNTS.find((x) => x.role === r); const I = ROLE_INFO[r].icon; return (
              <motion.button key={r} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.08 }} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} disabled={demoLogin.isPending} onClick={() => demoLogin.mutate(r)}
                className="card card-lift flex flex-col items-start gap-3 p-4 text-left disabled:opacity-60" aria-label={`Try demo as ${ROLE_INFO[r].label}`}>
                {a ? <Avatar seed={a.avatar_seed} name={a.name} size={46} /> : <span className="skeleton h-[46px] w-[46px] !rounded-full" />}
                <div><p className="flex items-center gap-1.5 text-[15px] font-extrabold leading-tight">{a?.name ?? '…'}</p><p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-muted"><I className="h-3.5 w-3.5" />{ROLE_INFO[r].label} · {ROLE_INFO[r].blurb}</p></div>
                <span className="text-sm font-bold text-teal">Try demo →</span></motion.button>); })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
