import { motion, useAnimationControls } from 'framer-motion';
import { AlertTriangle, Check, Clock, MessageSquarePlus, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PillIcon } from './PillIcon';
import { fmtStamp, fmtTime } from '../lib/time';
import { springBouncy, springSoft } from '../lib/motion';
import type { Dose } from '../lib/types';

interface Props {
  dose: Dose; onTake: (d: Dose, x: number, y: number) => void; onUndo: (d: Dose) => void; onNote?: (d: Dose, note: string) => void;
  shaking?: boolean; isNew?: boolean; readOnly?: boolean; index?: number; highlight?: boolean;
}

const CHIP: Record<string, { label: string; cls: string }> = {
  upcoming: { label: 'Upcoming', cls: 'bg-ink/8 text-muted' },
  due: { label: 'Due now', cls: 'bg-teal/15 text-teal' },
  overdue: { label: 'Overdue', cls: 'bg-amber/20 text-amber' },
  missed: { label: 'Missed', cls: 'bg-coral/15 text-coral' },
  skipped: { label: 'Skipped', cls: 'bg-ink/10 text-muted' },
  taken: { label: 'Taken', cls: 'bg-leaf/20 text-leaf' },
  pending: { label: 'Pending', cls: 'bg-ink/8 text-muted' },
};

/** Large tactile medicine card. Tap = take. Includes the full "taken" choreography. */
export function DoseCard({ dose, onTake, onUndo, onNote, shaking, isNew, readOnly, index = 0, highlight }: Props) {
  const taken = dose.status === 'taken';
  const prev = useRef(dose.status);
  const [play, setPlay] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const pill = useAnimationControls();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prev.current !== 'taken' && taken) {
      setPlay(true);
      // squish with spring physics: 1 → 0.9 → 1.08 → 1
      (async () => {
        await pill.start({ scale: 0.9, transition: { duration: 0.09, ease: 'easeIn' } });
        await pill.start({ scale: 1.08, rotate: -6, transition: { type: 'spring', stiffness: 520, damping: 11 } });
        await pill.start({ scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 14 } });
      })();
      const t = setTimeout(() => setPlay(false), 1600);
      prev.current = dose.status; return () => clearTimeout(t);
    }
    prev.current = dose.status;
  }, [dose.status]);

  const chip = taken ? { label: `${dose.late ? 'Late · ' : ''}${fmtStamp(dose.taken_at)}`, cls: dose.late ? 'bg-amber/20 text-amber' : CHIP.taken.cls } : CHIP[dose.state] ?? CHIP.pending;
  const overdue = dose.state === 'overdue';
  const click = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (readOnly) return;
    const r = ref.current!.getBoundingClientRect();
    const x = 'clientX' in e && e.clientX ? e.clientX : r.left + r.width / 2, y = 'clientY' in e && e.clientY ? e.clientY : r.top + r.height / 2;
    if (taken) onUndo(dose); else onTake(dose, x, y);
  };

  return (
    <motion.div layout="position" initial={isNew ? { opacity: 0, x: 60, scale: 0.9 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ...springSoft, delay: isNew ? 0.15 : index * 0.05 }}>
      <div ref={ref} role={readOnly ? undefined : 'button'} tabIndex={readOnly ? -1 : 0} aria-label={readOnly ? undefined : taken ? `${dose.name} taken. Press to undo.` : `Mark ${dose.name} ${dose.dosage} as taken`}
        aria-pressed={readOnly ? undefined : taken}
        onClick={click} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); click(e); } }}
        className={`card relative overflow-hidden ${readOnly ? '' : 'card-lift cursor-pointer active:scale-[.985]'} ${overdue && !taken ? 'animate-amberPulse !border-amber/50' : ''} ${shaking ? 'animate-shake' : ''} ${highlight || isNew ? 'ring-2 ring-teal/60' : ''}`}
        style={{ transition: 'transform .15s' }}>
        {/* green gradient sweep, left → right */}
        <motion.div className="absolute inset-0 origin-left" style={{ background: 'linear-gradient(100deg, rgb(var(--leaf) / .22), rgb(var(--mint) / .16) 70%, transparent)' }}
          initial={false} animate={{ scaleX: taken ? 1 : 0 }} transition={{ duration: play ? 0.7 : 0, ease: [0.22, 1, 0.36, 1] }} />
        {/* ring drawn around the card */}
        {taken && (
          <svg className="pointer-events-none absolute inset-[1.5px] h-[calc(100%-3px)] w-[calc(100%-3px)] overflow-visible" aria-hidden="true">
            <motion.rect x="0" y="0" width="100%" height="100%" rx="19" fill="none" stroke="rgb(var(--leaf))" strokeWidth="3"
              initial={{ pathLength: play ? 0 : 1, opacity: play ? 1 : 0.35 }} animate={{ pathLength: 1, opacity: play ? [1, 1, 0.35] : 0.35 }} transition={{ duration: play ? 0.9 : 0, opacity: { duration: 1.6 } }} />
          </svg>
        )}
        {isNew && <span className="absolute right-3 top-3 z-10 rounded-full bg-teal px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#04211d]">New</span>}

        <div className="relative flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
          <motion.div animate={pill} className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl" style={{ background: `radial-gradient(circle at 30% 25%, ${dose.color}33, ${dose.color}11 70%)` }}>
            <PillIcon form={dose.form} color={dose.color} size={60} name={dose.name} />
            {taken && (
              <motion.span className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full bg-leaf shadow-soft" initial={{ scale: play ? 0 : 1 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: play ? 0.35 : 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><motion.path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: play ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: play ? 0.45 : 0, delay: play ? 0.45 : 0 }} /></svg>
              </motion.span>
            )}
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className={`font-display text-[1.45rem] font-semibold leading-tight ${taken ? 'opacity-90' : ''}`}>{dose.name}</h3>
              <span className="text-[15px] font-semibold text-muted">{dose.dosage}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-muted">
              <span className="inline-flex items-center gap-1.5 font-semibold"><Clock className="h-4 w-4" />{fmtTime(dose.time)}</span>
              {dose.instructions && <span className="hidden truncate sm:inline">· {dose.instructions}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`chip ${chip.cls}`}>{overdue && !taken && <AlertTriangle className="h-3.5 w-3.5" />}{taken && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{chip.label}</span>
              {!taken && !readOnly && dose.state !== 'missed' && <span className="text-sm font-semibold text-teal">Tap to take</span>}
              {dose.state === 'missed' && !readOnly && <span className="text-sm font-semibold text-coral">Tap to log it late</span>}
              {taken && !readOnly && <span className="inline-flex items-center gap-1 text-sm text-muted"><Undo2 className="h-3.5 w-3.5" />Tap to undo</span>}
              {dose.note && <span className="chip bg-ink/8 text-muted" title="Note">“{dose.note}”</span>}
            </div>
          </div>
          {taken && !readOnly && onNote && !dose.note && (
            <button className="btn-icon shrink-0" aria-label="Add a note to this dose" onClick={(e) => { e.stopPropagation(); setNoteOpen((o) => !o); }}><MessageSquarePlus className="h-5 w-5" /></button>
          )}
        </div>
        {noteOpen && (
          <form className="relative flex gap-2 px-5 pb-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (note.trim()) { onNote?.(dose, note.trim()); setNoteOpen(false); setNote(''); } }}>
            <input autoFocus className="input" placeholder="e.g. felt a little dizzy" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} aria-label="Dose note" />
            <button className="btn-primary" type="submit">Save</button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
