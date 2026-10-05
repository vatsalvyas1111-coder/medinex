import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Printer, Search, Sparkles, Wand2 } from 'lucide-react';
import { useMe } from '../lib/hooks';
import { useUI } from '../lib/store';
import { NAV } from './Shell';
import { spring } from '../lib/motion';

/** Ctrl/Cmd+K quick navigation. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, toggleTheme, setMediOpen, setDemoOpen } = useUI();
  const { data: me } = useMe(); const nav = useNavigate();
  const [q, setQ] = useState(''); const [idx, setIdx] = useState(0); const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(!useUI.getState().paletteOpen); } if (e.key === 'Escape') setPaletteOpen(false); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => { if (paletteOpen) { setQ(''); setIdx(0); setTimeout(() => input.current?.focus(), 50); } }, [paletteOpen]);
  const cmds = useMemo(() => {
    if (!me) return [];
    return [
      ...NAV[me.role].map((n) => ({ label: `Go to ${n.label}`, icon: n.icon, run: () => nav(n.to) })),
      { label: 'Ask Medi…', icon: Sparkles, run: () => setMediOpen(true) },
      { label: 'Toggle light / dark theme', icon: Moon, run: toggleTheme },
      { label: 'Open Demo Panel', icon: Wand2, run: () => setDemoOpen(true) },
      { label: 'Print monthly report', icon: Printer, run: () => { nav(me.role === 'patient' ? '/analytics' : '/dashboard'); setTimeout(() => window.print(), 900); } },
    ];
  }, [me]);
  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  const go = (i: number) => { list[i]?.run(); setPaletteOpen(false); };
  return (
    <AnimatePresence>
      {paletteOpen && me && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setPaletteOpen(false)}>
          <motion.div role="dialog" aria-label="Command palette" className="glass w-full max-w-lg overflow-hidden rounded-xl2 shadow-lift" initial={{ y: -20, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -12, scale: 0.97, opacity: 0 }} transition={spring} onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line/10 px-4"><Search className="h-5 w-5 text-muted" />
              <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Type a command…" className="min-h-[56px] flex-1 bg-transparent text-lg outline-none placeholder:text-muted/70"
                onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); } if (e.key === 'Enter') go(idx); }} /></div>
            <ul className="max-h-80 overflow-auto p-2">
              {list.map((c, i) => (
                <li key={c.label}><button onMouseEnter={() => setIdx(i)} onClick={() => go(i)} className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left font-semibold ${i === idx ? 'bg-teal/15 text-ink' : 'text-muted'}`}><c.icon className={`h-5 w-5 ${i === idx ? 'text-teal' : ''}`} />{c.label}</button></li>
              ))}
              {!list.length && <li className="px-3 py-6 text-center text-muted">No matching commands</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
