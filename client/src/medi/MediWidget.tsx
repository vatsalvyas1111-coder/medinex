import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Mic, MicOff, RotateCcw, SendHorizonal, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useMe } from '../lib/hooks';
import { useUI } from '../lib/store';
import { greeting, useNow } from '../lib/time';
import type { CardSpec, ChatMsg, PatientSummary } from '../lib/types';
import { ParticleField } from '../components/ParticleField';
import { Markdown } from './Markdown';
import { MediCard } from './Cards';
import { spring } from '../lib/motion';

type Phase = 'idle' | 'listening' | 'thinking';

function Orb({ phase, size = 40 }: { phase: Phase; size?: number }) {
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-hidden="true">
      {phase === 'thinking' && <span className="absolute -inset-[3px] animate-spin360 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 0 55%, rgb(var(--teal)), rgb(var(--amber)), transparent)', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))' }} />}
      {phase === 'listening' && <motion.span className="absolute inset-0 rounded-full bg-teal/40" animate={{ scale: [1, 1.7], opacity: [0.6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
      <motion.span className="block rounded-full" style={{ width: size * 0.82, height: size * 0.82, background: 'radial-gradient(circle at 30% 28%, #ecfdf5, #5eead4 35%, #14b8a6 70%, #0f766e)', boxShadow: '0 0 24px rgb(var(--teal) / .55), inset 0 -4px 10px rgba(0,0,0,.18)' }}
        animate={phase === 'idle' ? { scale: [1, 1.06, 1] } : phase === 'listening' ? { scale: [1, 1.14, 1] } : { scale: 1 }} transition={{ duration: phase === 'listening' ? 0.7 : 3.2, repeat: Infinity }} />
    </span>
  );
}

const chipsFor = (role: string, path: string, first?: string): string[] => {
  if (role === 'patient') {
    if (path.startsWith('/medicines')) return ['Explain my medicines simply', 'Any refills coming up?', 'What is due today?', 'What if I miss a dose?'];
    if (path.startsWith('/requests')) return ['Help me write a medicine request', 'My knee hurts at night', 'What should I tell the doctor?', 'What is due today?'];
    return ['What is due today?', 'How am I doing this week?', 'Do I need any refills?', 'Help me write a medicine request'];
  }
  if (role === 'tracker') return [`How has ${first ?? 'my patient'} been this week?`, 'Which medicine is missed the most?', 'What should I talk to them about?', 'Who is running low on medicine?'];
  return ['Summarise the pending requests', 'Which requests have interaction flags?', 'What information is missing?', 'Explain the interaction flag simply'];
};

export function MediWidget() {
  const { data: me } = useMe(); const { mediOpen, setMediOpen, mediUnread, mediPrompt, clearPrompt } = useUI(); const loc = useLocation(); const now = useNow(60000);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]); const [text, setText] = useState(''); const [phase, setPhase] = useState<Phase>('idle');
  const [provider, setProvider] = useState<string>(''); const [loaded, setLoaded] = useState(false); const [voice, setVoice] = useState(false);
  const scroller = useRef<HTMLDivElement>(null); const abort = useRef<AbortController | null>(null); const recRef = useRef<any>(null);
  const { data: trackerPatients } = useQuery({ queryKey: ['tracker-patients'], queryFn: () => api.get<{ patients: PatientSummary[] }>('/trackers/patients'), enabled: me?.role === 'tracker', staleTime: 60000 });
  const firstName = me?.name.replace(/^Dr\.?\s*/, '').split(' ')[0] ?? '';
  const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => { if (me) { setMsgs([]); setLoaded(false); } }, [me?.id]);
  useEffect(() => {
    if (!mediOpen || loaded || !me) return;
    api.get<{ messages: ChatMsg[]; provider: string }>('/ai/history').then((r) => { setMsgs(r.messages); setProvider(r.provider); setLoaded(true); }).catch(() => setLoaded(true));
  }, [mediOpen, loaded, me]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [msgs, mediOpen]);

  const send = useCallback(async (raw: string) => {
    const message = raw.trim(); if (!message || phase === 'thinking') return;
    setText('');
    const uid = `u${Date.now()}`, aid = `a${Date.now()}`;
    setMsgs((m) => [...m, { id: uid, role: 'user', content: message }, { id: aid, role: 'assistant', content: '', streaming: true }]);
    setPhase('thinking');
    const ac = new AbortController(); abort.current = ac;
    const patchA = (fn: (m: ChatMsg) => ChatMsg) => setMsgs((ms) => ms.map((m) => (m.id === aid ? fn(m) : m)));
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal: ac.signal });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message ?? 'Medi is unavailable right now.'); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
          if (!line.startsWith('data:')) continue;
          const ev = JSON.parse(line.slice(5));
          if (ev.type === 'meta') setProvider(ev.provider);
          else if (ev.type === 'token') patchA((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === 'card') patchA((m) => ({ ...m, card: ev.card as CardSpec }));
          else if (ev.type === 'error') patchA((m) => ({ ...m, content: ev.message, error: true }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patchA((m) => ({ ...m, content: m.content || (e as Error).message, error: true }));
    } finally { patchA((m) => ({ ...m, streaming: false })); setPhase('idle'); }
  }, [phase]);

  useEffect(() => { if (mediOpen && mediPrompt) { send(mediPrompt); clearPrompt(); } }, [mediOpen, mediPrompt]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && useUI.getState().mediOpen && !useUI.getState().paletteOpen) setMediOpen(false); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const toggleVoice = () => {
    if (voice) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SR) return;
    const rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = true; rec.continuous = false; recRef.current = rec;
    rec.onstart = () => { setVoice(true); setPhase('listening'); };
    rec.onresult = (e: any) => { setText(Array.from(e.results).map((r: any) => r[0].transcript).join('')); };
    rec.onend = () => { setVoice(false); setPhase((p) => (p === 'listening' ? 'idle' : p)); };
    rec.onerror = () => { setVoice(false); setPhase('idle'); };
    rec.start();
  };
  const clear = async () => { abort.current?.abort(); await api.del('/ai/history'); setMsgs([]); setPhase('idle'); };

  if (!me) return null;
  const chips = chipsFor(me.role, loc.pathname, trackerPatients?.patients[0]?.patient.name.split(' ')[0]);
  const subtitle = me.role === 'patient' ? 'Your medicine companion' : me.role === 'tracker' ? 'Caregiver assistant' : 'Review assistant';

  return (
    <>
      {/* floating orb */}
      <AnimatePresence>
        {!mediOpen && (
          <motion.button aria-label="Open Medi, your AI companion" onClick={() => useUI.getState().setMediOpen(true)} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={spring}
            className="no-print fixed bottom-24 right-4 z-[60] grid h-[76px] w-[76px] place-items-center rounded-full lg:bottom-6 lg:right-6">
            <span className="pointer-events-none absolute -inset-5"><ParticleField mode="ambient" count={14} color={['#5eead4', '#fde68a', '#fff']} speed={0.5} /></span>
            <span className="absolute -inset-3 animate-breathe rounded-full" style={{ background: "radial-gradient(circle, rgba(45,212,191,.55) 0%, rgba(45,212,191,.18) 45%, rgba(45,212,191,0) 70%)" }} />
            <span className="relative grid h-[62px] w-[62px] place-items-center rounded-full shadow-glow" style={{ background: 'radial-gradient(circle at 30% 25%, #ecfdf5, #5eead4 32%, #14b8a6 68%, #0f766e)' }}>
              <Sparkles className="h-7 w-7 text-[#04211d]" strokeWidth={2.2} />
            </span>
            {mediUnread && <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-coral ring-2 ring-[rgb(var(--bg))]"><span className="absolute inset-0 animate-ping rounded-full bg-coral/70" /></span>}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mediOpen && (
          <motion.section role="dialog" aria-label="Medi AI companion" initial={{ opacity: 0, y: 40, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.94 }} transition={spring}
            className="no-print fixed bottom-2 right-2 z-[65] flex h-[min(680px,calc(100vh-1rem))] w-[min(420px,calc(100vw-1rem))] origin-bottom-right flex-col overflow-hidden rounded-[28px] border border-line/15 shadow-lift lg:bottom-5 lg:right-5"
            style={{ background: 'linear-gradient(160deg, rgb(var(--surface) / .82), rgb(var(--surface) / .62))', backdropFilter: 'blur(28px) saturate(1.5)', WebkitBackdropFilter: 'blur(28px) saturate(1.5)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), inset 0 0 60px rgb(var(--teal) / .12), 0 30px 80px rgba(0,0,0,.28)' }}>
            <header className="flex items-center gap-3 px-4 pb-3 pt-4">
              <Orb phase={phase} size={44} />
              <div className="min-w-0"><h2 className="font-display text-xl font-semibold leading-none">Medi</h2>
                <p className="mt-1 text-xs font-semibold text-muted">{phase === 'thinking' ? 'Thinking…' : phase === 'listening' ? 'Listening…' : subtitle}{provider === 'local' && phase === 'idle' ? ' · offline mode' : ''}</p></div>
              <button className="btn-icon ml-auto !min-h-[44px] !min-w-[44px]" aria-label="Start a new chat" onClick={clear}><RotateCcw className="h-[18px] w-[18px]" /></button>
              <button className="btn-icon !min-h-[44px] !min-w-[44px]" aria-label="Close Medi" onClick={() => setMediOpen(false)}><X className="h-5 w-5" /></button>
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 pb-3" aria-live="polite">
              {msgs.length === 0 && loaded && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center px-2 py-6 text-center">
                  <Orb phase="idle" size={84} />
                  <h3 className="mt-5 font-display text-3xl font-semibold leading-tight">{greeting(now)},<br />{firstName}</h3>
                  <p className="mt-2 max-w-[280px] text-[15px] text-muted">I can look at your real Medinex data. Ask me anything, or tap a suggestion.</p>
                  <div className="mt-5 grid w-full grid-cols-1 gap-2">{chips.map((c, i) => (
                    <motion.button key={c} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => send(c)}
                      className="min-h-[48px] rounded-2xl border border-line/15 bg-surface/70 px-4 text-left text-[15px] font-semibold hover:border-teal/50 hover:bg-teal/10">{c}</motion.button>))}</div>
                </motion.div>
              )}
              {msgs.length === 0 && !loaded && <div className="space-y-3 pt-4"><div className="skeleton h-14 w-3/4" /><div className="skeleton ml-auto h-10 w-1/2" /></div>}
              {msgs.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] rounded-[22px] px-4 py-3 text-[15.5px] leading-relaxed ${m.role === 'user' ? 'rounded-br-md bg-gradient-to-br from-teal to-mint text-[#04211d] font-semibold' : `rounded-bl-md border border-line/10 bg-surface/80 ${m.error ? 'text-coral' : ''}`}`}>
                    {m.role === 'assistant' ? (
                      <>{m.content ? <Markdown text={m.content} /> : m.streaming ? <span className="inline-flex gap-1 py-1" aria-label="Medi is typing">{[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-teal" animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}</span> : null}
                        {m.streaming && m.content && <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded bg-teal" />}
                        {m.card && <MediCard card={m.card} />}</>
                    ) : m.content}
                  </div>
                </motion.div>
              ))}
            </div>

            {msgs.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-4 pb-2">{chips.slice(0, 4).map((c) => <button key={c} onClick={() => send(c)} disabled={phase === 'thinking'} className="shrink-0 rounded-full border border-line/15 bg-surface/70 px-3.5 py-2 text-[13px] font-semibold hover:border-teal/50 hover:bg-teal/10 disabled:opacity-50">{c}</button>)}</div>
            )}
            <form className="flex items-center gap-2 px-3 pb-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={voice ? 'Listening…' : 'Ask Medi…'} className="input !rounded-full" aria-label="Message Medi" maxLength={1200} />
              {speechSupported && <button type="button" onClick={toggleVoice} aria-label={voice ? 'Stop voice input' : 'Start voice input'} className={`btn-icon !rounded-full ${voice ? '!bg-coral/20 !text-coral' : ''}`}>{voice ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>}
              <button type="submit" aria-label="Send message" disabled={!text.trim() || phase === 'thinking'} className="btn-primary !min-w-[48px] !rounded-full !px-3"><SendHorizonal className="h-5 w-5" /></button>
            </form>
            <p className="px-4 pb-3 text-center text-[11.5px] font-semibold text-muted">Medi shares general information, not medical advice.</p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
