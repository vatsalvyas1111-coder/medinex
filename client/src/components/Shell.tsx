import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, FilePlus2, HeartPulse, Inbox, LayoutDashboard, LogOut, Moon, Pill, ScrollText, Search, Sun, SunMedium, Users, BarChart3, Radio } from 'lucide-react';
import { NavLink, useLocation, useNavigate, useOutlet, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { Wordmark, LogoMark } from './Logo';
import { api } from '../lib/api';
import { useAlerts, useMe } from '../lib/hooks';
import { useUI } from '../lib/store';
import { pageVariants, spring } from '../lib/motion';
import { fmtTime, pad, relative, useNow } from '../lib/time';
import type { Role } from '../lib/types';

export const NAV: Record<Role, { to: string; label: string; icon: typeof Pill }[]> = {
  patient: [
    { to: '/today', label: 'Today', icon: SunMedium }, { to: '/history', label: 'History', icon: CalendarDays }, { to: '/medicines', label: 'Medicines', icon: Pill },
    { to: '/requests', label: 'Requests', icon: FilePlus2 }, { to: '/analytics', label: 'Analytics', icon: BarChart3 }, { to: '/emergency', label: 'Emergency', icon: HeartPulse }, { to: '/links', label: 'Family', icon: Users },
  ],
  tracker: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { to: '/alerts', label: 'Alerts', icon: Bell }, { to: '/links', label: 'Patients', icon: Users }],
  reviewer: [{ to: '/queue', label: 'Requests', icon: Inbox }, { to: '/audit', label: 'Audit trail', icon: ScrollText }],
};

function NavItem({ to, label, icon: Icon, compact }: { to: string; label: string; icon: typeof Pill; compact?: boolean }) {
  return (
    <NavLink to={to} className={({ isActive }) => `relative flex items-center gap-3 rounded-2xl font-semibold transition-colors ${compact ? 'min-w-[68px] flex-1 flex-col gap-0.5 px-1 py-2 text-[11px]' : 'px-4 py-3 text-[15px]'} ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>
      {({ isActive }) => (<>
        {isActive && <motion.span layoutId={compact ? 'nav-pill-m' : 'nav-pill'} transition={spring} className="absolute inset-0 rounded-2xl bg-surface/80 shadow-soft ring-1 ring-line/10" />}
        <Icon className={`relative h-[22px] w-[22px] ${isActive ? 'text-teal' : ''}`} strokeWidth={2} /><span className="relative">{label}</span>
      </>)}
    </NavLink>
  );
}

function BellMenu() {
  const { data } = useAlerts(); const [open, setOpen] = useState(false); const now = useNow(30000); const qc = useQueryClient(); const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const unread = data?.unread ?? 0;
  return (
    <div className="relative" ref={ref}>
      <button className="btn-icon relative" aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen((o) => !o)}>
        <motion.span key={unread} animate={unread ? { rotate: [0, -18, 14, -8, 0] } : {}} transition={{ duration: 0.6 }}><Bell className="h-5 w-5" /></motion.span>
        <AnimatePresence>{unread > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-coral px-1 text-[11px] font-extrabold text-white">{unread}</motion.span>}</AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={spring}
            className="glass absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl shadow-lift">
            <div className="flex items-center justify-between px-4 py-3"><p className="font-bold">Notifications</p>
              <button className="text-sm font-semibold text-teal" onClick={async () => { await api.post('/alerts/read-all'); qc.invalidateQueries({ queryKey: ['alerts'] }); }}>Mark all read</button></div>
            <div className="max-h-80 overflow-auto">
              {(data?.alerts ?? []).slice(0, 6).map((a) => (
                <button key={a.id} onClick={() => { setOpen(false); nav('/alerts'); }} className="flex w-full items-start gap-3 border-t border-line/10 px-4 py-3 text-left hover:bg-ink/5">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.read ? 'bg-ink/15' : a.type === 'missed_dose' ? 'bg-coral' : 'bg-teal'}`} />
                  <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{a.message}</span><span className="text-xs text-muted">{relative(a.created_at, now)}</span></span>
                </button>
              ))}
              {!data?.alerts.length && <p className="px-4 py-8 text-center text-muted">You are all caught up.</p>}
            </div>
            <Link to="/alerts" onClick={() => setOpen(false)} className="block border-t border-line/10 px-4 py-3 text-center text-sm font-bold text-teal hover:bg-ink/5">Open notification center</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Shell() {
  const { data: me } = useMe(); const loc = useLocation(); const outlet = useOutlet(); const nav = useNavigate(); const qc = useQueryClient();
  const { theme, toggleTheme, setPaletteOpen, live } = useUI(); const now = useNow(15000);
  if (!me) return null;
  const items = NAV[me.role];
  const logout = async () => { await api.post('/auth/logout'); qc.clear(); nav('/login'); };
  return (
    <div className="relative z-10 min-h-screen lg:pl-[264px]">
      {/* desktop sidebar */}
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-[240px] flex-col rounded-xl2 p-4 shadow-soft lg:flex">
        <Link to="/" className="px-2 pb-6 pt-2"><Wordmark size={19} /></Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">{items.map((i) => <NavItem key={i.to} {...i} />)}</nav>
        <div className="mt-3 rounded-2xl border border-line/10 bg-surface/50 p-3">
          <div className="flex items-center gap-3"><Avatar seed={me.avatar_seed} name={me.name} size={42} /><div className="min-w-0"><p className="truncate font-bold leading-tight">{me.name}</p><p className="text-xs font-semibold capitalize text-muted">{me.role}</p></div></div>
          <button onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>

      <header className="app-header no-print sticky top-0 z-20 flex items-center gap-2 px-4 py-3 sm:px-8">
        <Link to="/" className="lg:hidden"><LogoMark size={38} /></Link>
        <button onClick={() => setPaletteOpen(true)} className="glass ml-auto hidden min-h-[48px] items-center gap-3 rounded-2xl px-4 text-sm text-muted transition hover:text-ink sm:flex" aria-label="Open command palette">
          <Search className="h-4 w-4" /> Search or jump to… <kbd className="rounded-md border border-line/15 bg-surface/70 px-1.5 py-0.5 text-[11px] font-bold">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2 sm:ml-2">
          <span className="glass hidden min-h-[48px] items-center gap-2 rounded-2xl px-3.5 text-sm font-bold md:inline-flex" title="Demo clock — server time">
            <Radio className={`h-4 w-4 ${live ? 'text-leaf' : 'text-muted'}`} />{fmtTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`)}
          </span>
          <button className="btn-icon sm:hidden" aria-label="Search" onClick={() => setPaletteOpen(true)}><Search className="h-5 w-5" /></button>
          <button className="btn-icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
            <AnimatePresence mode="wait" initial={false}><motion.span key={theme} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.22 }}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</motion.span></AnimatePresence>
          </button>
          <BellMenu />
          <button className="lg:hidden" onClick={logout} aria-label="Sign out"><Avatar seed={me.avatar_seed} name={me.name} size={44} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-2 sm:px-8 lg:pb-16">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={loc.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">{outlet}</motion.div>
        </AnimatePresence>
      </main>

      {/* mobile / tablet bottom nav */}
      <nav aria-label="Main" className="glass no-print fixed inset-x-2 bottom-2 z-30 flex overflow-x-auto rounded-[26px] p-1.5 shadow-lift lg:hidden">
        {items.map((i) => <NavItem key={i.to} {...i} compact />)}
      </nav>
    </div>
  );
}
