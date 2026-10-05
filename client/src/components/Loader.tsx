import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ParticleField, ParticleHandle } from './ParticleField';
import { LogoMark } from './Logo';
import { prefersReducedMotion } from '../lib/motion';

const SEEN = 'medinex_loader_seen';
type Stage = 'gather' | 'ecg' | 'capsule' | 'split' | 'word' | 'tagline';
const COLORS = ['#5eead4', '#2dd4bf', '#99f6e4', '#a7f3d0', '#fde68a', '#ffffff'];

/** Sample the MEDINEX wordmark into target points for the particles. */
function wordPoints(w: number, h: number) {
  const fs = Math.max(48, Math.min(w * 0.11, 132));
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
  const ctx = c.getContext('2d')!;
  ctx.font = `700 ${fs}px Fraunces, 'Iowan Old Style', Georgia, serif`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  const track = fs * 0.06; const text = 'MEDINEX';
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1);
  let x = (w - total) / 2; const y = h / 2 - 8;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + track; });
  const data = ctx.getImageData(0, 0, c.width, c.height).data; const step = Math.max(4, Math.round(fs / 22));
  const pts: { x: number; y: number }[] = [];
  for (let py = 0; py < c.height; py += step) for (let px = 0; px < c.width; px += step) if (data[(py * c.width + px) * 4 + 3] > 128) pts.push({ x: px, y: py });
  return { pts, span: [(w - total) / 2, (w + total) / 2] as [number, number], fs };
}

const ECG = 'M0 100 H300 l16 -8 l16 8 H390 l14 -10 l14 10 H470 l12 14 l22 -96 l24 140 l18 -58 H610 l22 -16 l30 16 H1000';
const CAP_L = 'M100 10 H52 A40 40 0 0 0 52 90 H100 Z';
const CAP_R = 'M100 10 H148 A40 40 0 0 1 148 90 H100 Z';
const CAP_O = 'M52 10 H148 A40 40 0 0 1 148 90 H52 A40 40 0 0 1 52 10 Z';

export function Loader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const seenBefore = useMemo(() => { try { return !!sessionStorage.getItem(SEEN); } catch { return false; } }, []);
  const pf = useRef<ParticleHandle>(null);
  const [stage, setStage] = useState<Stage>('gather');
  const [timeDone, setTimeDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [word, setWord] = useState({ fs: 100 });
  const r = useMotionValue(0);
  const mask = useTransform(r, (v) => `radial-gradient(circle at 50% 50%, transparent ${v}%, #000 ${v + 0.6}%)`);
  const [revealing, setRevealing] = useState(false);
  const barW = useMotionValue(0);
  const doneRef = useRef(onDone); doneRef.current = onDone;

  // timeline
  useEffect(() => {
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* */ }
    if (reduced) { const t = setTimeout(() => setTimeDone(true), 1000); return () => clearTimeout(t); }
    const T: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => T.push(setTimeout(fn, ms));
    at(150, () => pf.current?.converge(1));                    // a single particle drifts…
    at(520, () => pf.current?.converge(420));                  // …then hundreds converge
    at(1000, () => setStage('ecg'));                           // 1.0s  ECG line draws
    at(2500, () => setStage('capsule'));                       // 2.5s  line curls into a capsule
    at(3350, () => { setStage('split'); const s = pf.current?.size(); if (s) pf.current?.pour(s.w / 2, s.h / 2, 260); }); // capsule splits, particles pour
    at(4000, () => {                                           // 4.0s  particles assemble the wordmark
      setStage('word');
      const s = pf.current?.size(); if (!s) return;
      const { pts, span, fs } = wordPoints(s.w, s.h); setWord({ fs });
      pf.current?.assemble(pts, span);
    });
    at(5000, () => setStage('tagline'));                       // 5.0s  tagline
    at(5600, () => setTimeDone(true));
    animate(barW, 94, { duration: 5.2, ease: 'easeInOut' });
    return () => T.forEach(clearTimeout);
  }, [reduced]);

  const finish = timeDone || skipped;
  useEffect(() => {
    if (!finish || !ready || revealing) return;
    setRevealing(true);
    animate(barW, 100, { duration: 0.25 });
    const a = animate(r, 150, { duration: reduced ? 0.4 : 0.95, delay: 0.25, ease: [0.65, 0, 0.2, 1], onComplete: () => doneRef.current() });
    return () => a.stop();
  }, [finish, ready]);

  const inEcg = stage === 'ecg';
  const capsuleShown = stage === 'capsule' || stage === 'split';

  return (
    <motion.div className="fixed inset-0 z-[100] overflow-hidden text-white" style={{ WebkitMaskImage: mask, maskImage: mask, background: 'radial-gradient(120% 90% at 50% 40%, #12204a 0%, #0B1020 55%, #060a16 100%)' }}
      role="status" aria-label="Loading Medinex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0.3 : 1 }}>
      {reduced ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <LogoMark size={96} /><p className="font-display text-3xl tracking-[.2em]">MEDINEX</p>
        </div>
      ) : (
        <>
          <div className="absolute inset-0"><ParticleField ref={pf} mode="converge" color={COLORS} additive count={600} /></div>

          {/* ECG line */}
          <motion.svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute left-0 top-1/2 h-[200px] w-full -translate-y-1/2" fill="none"
            animate={{ opacity: inEcg ? 1 : 0, scaleX: capsuleShown || stage === 'word' ? 0.15 : 1 }} initial={{ opacity: 0 }} transition={{ opacity: { duration: 0.5 }, scaleX: { duration: 0.9, ease: [0.7, 0, 0.3, 1] } }}>
            <defs><linearGradient id="ecg" x1="0" x2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity="0" /><stop offset=".25" stopColor="#2dd4bf" /><stop offset=".75" stopColor="#a7f3d0" /><stop offset="1" stopColor="#a7f3d0" stopOpacity="0" /></linearGradient></defs>
            {inEcg && (
              <motion.g animate={{ scaleY: [1, 1.08, 1, 1.05, 1] }} transition={{ delay: 1, duration: 0.5, repeat: 2, repeatDelay: 0.05 }} style={{ originY: '100px' }}>
                <motion.path d={ECG} stroke="url(#ecg)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: 'easeInOut' }} style={{ filter: 'drop-shadow(0 0 8px #2dd4bf)' }} />
              </motion.g>
            )}
          </motion.svg>

          {/* capsule that splits open */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.svg viewBox="0 0 200 100" width="300" height="150" fill="none" style={{ rotate: -32 }} initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: capsuleShown ? 1 : 0, scale: stage === 'split' ? 1.06 : capsuleShown ? 1 : 0.6 }} transition={{ duration: 0.6 }}>
              <defs>
                <linearGradient id="cl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0d9488" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient>
                <linearGradient id="cr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#ecfdf5" /></linearGradient>
              </defs>
              {capsuleShown && stage !== 'split' && (
                <motion.path d={CAP_O} stroke="#5eead4" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} style={{ filter: 'drop-shadow(0 0 10px #2dd4bf)' }} />
              )}
              <motion.g animate={stage === 'split' ? { x: -46, rotate: -16, opacity: 0.0 } : { x: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} style={{ originX: '100px', originY: '50px' }}>
                <motion.path d={CAP_L} fill="url(#cl)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }} />
              </motion.g>
              <motion.g animate={stage === 'split' ? { x: 46, rotate: 16, opacity: 0.0 } : { x: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} style={{ originX: '100px', originY: '50px' }}>
                <motion.path d={CAP_R} fill="url(#cr)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }} />
              </motion.g>
              {stage === 'split' && <motion.circle cx="100" cy="50" r="6" fill="#fff" initial={{ scale: 0, opacity: 1 }} animate={{ scale: 14, opacity: 0 }} transition={{ duration: 0.9 }} style={{ originX: '100px', originY: '50px' }} />}
            </motion.svg>
          </div>

          {/* crisp wordmark with a light sweep, layered over the particles */}
          {(stage === 'word' || stage === 'tagline') && (
            <motion.div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-[calc(50%+8px)] justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75, duration: 0.6 }}>
              <h1 className="word-sweep font-display font-bold" style={{ fontSize: word.fs, letterSpacing: '.06em', lineHeight: 1, animationDelay: '.8s' }}>MEDINEX</h1>
            </motion.div>
          )}
          <motion.p className="absolute inset-x-0 top-1/2 mt-[calc(4rem+2vw)] text-center font-display text-xl italic text-teal-100/90 sm:text-2xl" initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: stage === 'tagline' ? 1 : 0, y: stage === 'tagline' ? 0 : 8 }} transition={{ duration: 0.7 }}>Never miss a dose.</motion.p>
        </>
      )}

      {/* progress bar */}
      <div className="absolute inset-x-0 bottom-[12%] mx-auto h-[3px] w-[min(280px,60vw)] overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full" style={{ width: useTransform(barW, (v) => `${v}%`), background: 'linear-gradient(90deg,#14b8a6,#a7f3d0)' }} />
      </div>
      {seenBefore && !finish && (
        <button className="absolute bottom-6 right-6 rounded-full px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white" onClick={() => setSkipped(true)}>Skip</button>
      )}
    </motion.div>
  );
}
