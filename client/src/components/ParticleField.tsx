import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Engine, Mode } from '../lib/particles';
import { prefersReducedMotion } from '../lib/motion';

export interface ParticleHandle {
  burst: (x: number, y: number, opts?: { count?: number; colors?: string[] }) => void;
  converge: (n: number, cx?: number, cy?: number) => void;
  pour: (x: number, y: number, n?: number) => void;
  assemble: (pts: { x: number; y: number }[], span: [number, number]) => void;
  size: () => { w: number; h: number };
}
interface Props {
  mode: Mode; count?: number; color?: string | string[]; speed?: number; mouseRepel?: boolean;
  className?: string; additive?: boolean; style?: React.CSSProperties; paused?: boolean;
}

/** Reusable canvas particle layer. Modes: ambient (background), burst (dose taken), converge (loader), celebrate (all done). */
export const ParticleField = forwardRef<ParticleHandle, Props>(function ParticleField(
  { mode, count = 60, color = '#2dd4bf', speed = 1, mouseRepel = false, className, additive = false, style, paused }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useImperativeHandle(ref, () => ({
    burst: (x, y, o) => engine.current?.burst(x, y, o?.count ?? 16, o?.colors),
    converge: (n, cx, cy) => { const e = engine.current; if (e) e.spawnConverge(n, cx ?? e.w / 2, cy ?? e.h / 2); },
    pour: (x, y, n) => engine.current?.pour(x, y, n),
    assemble: (pts, span) => engine.current?.assemble(pts, span),
    size: () => ({ w: engine.current?.w ?? 0, h: engine.current?.h ?? 0 }),
  }), []);

  useEffect(() => {
    const el = canvas.current!; const ctx = el.getContext('2d')!;
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4;
    const cap = Math.round((lowEnd ? 0.5 : 1) * Math.max(count, mode === 'burst' ? 160 : 0));
    const colors = Array.isArray(color) ? color : [color];
    const e = new Engine(mode, colors, speed, mouseRepel, mode === 'converge' ? 1200 : cap);
    engine.current = e;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = { width: el.offsetWidth, height: el.offsetHeight };
      el.width = Math.max(1, r.width * dpr); el.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); e.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    const reduced = prefersReducedMotion();
    if (mode === 'ambient') e.spawnAmbient(reduced ? Math.round(cap * .3) : Math.round(cap * .75));
    if (mode === 'celebrate') e.spawnCelebrate(reduced ? 10 : 50);

    const onMove = (ev: PointerEvent) => { const r = el.getBoundingClientRect(); e.mouse.x = ev.clientX - r.left; e.mouse.y = ev.clientY - r.top; };
    if (mouseRepel) window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0, last = performance.now(), running = true;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(3, (t - last) / 16.667); last = t;
      if (document.hidden || pausedRef.current) return; // pause when tab hidden
      if (mode === 'burst' && e.ps.length === 0) { ctx.clearRect(0, 0, e.w, e.h); return; } // idle = free
      ctx.clearRect(0, 0, e.w, e.h);
      e.step(dt); e.draw(ctx, additive);
    };
    raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('pointermove', onMove); void running; };
  }, [mode, count, JSON.stringify(color), speed, mouseRepel, additive]);

  return <canvas ref={canvas} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} aria-hidden="true" />;
});
