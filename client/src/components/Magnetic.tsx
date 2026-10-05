import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useRef } from 'react';

/** Wrapper that gently pulls its child toward the cursor (magnetic button). */
export function Magnetic({ children, strength = 0.28, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18 });
  return (
    <motion.div ref={ref} className={className} style={{ x, y, display: 'inline-block' }}
      onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); x.set((e.clientX - (r.left + r.width / 2)) * strength); y.set((e.clientY - (r.top + r.height / 2)) * strength); }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}
