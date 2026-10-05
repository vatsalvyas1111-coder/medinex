import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/** Animated count-up number. */
export function CountUp({ value, duration = 0.9, suffix = '', className }: { value: number; duration?: number; suffix?: string; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; mv.set(0); }
    const c = animate(mv, value, { duration: prefersReducedMotion() ? 0 : duration, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** Progress ring with gradient stroke; animates on mount and on value change. */
export function Ring({ value, size = 180, stroke = 14, children, from = 'rgb(var(--teal))', to = 'rgb(var(--mint))', shake = false, track = true }: {
  value: number; size?: number; stroke?: number; children?: React.ReactNode; from?: string; to?: string; shake?: boolean; track?: boolean }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  return (
    <motion.div className="relative" style={{ width: size, height: size }} animate={shake ? { x: [0, -7, 6, -4, 3, 0], rotate: [0, -1.5, 1.2, -.6, 0] } : { x: 0 }} transition={{ duration: 0.5 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
        {track && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--ink) / .08)" strokeWidth={stroke} />}
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ type: 'spring', stiffness: 60, damping: 16, mass: 1.1 }} style={{ filter: 'drop-shadow(0 0 8px rgb(var(--teal) / .45))' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </motion.div>
  );
}

/** Small status donut used on tracker cards. */
export function MiniRing({ value, size = 56, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  return <Ring value={value} size={size} stroke={stroke}><span className="text-[13px] font-extrabold">{label}</span></Ring>;
}
