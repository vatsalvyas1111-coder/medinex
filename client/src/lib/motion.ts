// One shared spring vocabulary so every interaction feels related.
export const spring = { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 } as const;
export const springSoft = { type: 'spring', stiffness: 220, damping: 26, mass: 1 } as const;
export const springBouncy = { type: 'spring', stiffness: 520, damping: 16, mass: 0.7 } as const;
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
export const rise = { hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: springSoft } };
export const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
};
export const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
