import { motion } from 'framer-motion';

/** Medinex mark: a capsule with a heartbeat line running through it. `animated` draws the line on a loop. */
export function LogoMark({ size = 40, animated = false, className }: { size?: number; animated?: boolean; className?: string }) {
  const id = `lg${size}${animated ? 'a' : ''}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Medinex">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0d9488" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#bbf7d0" /></linearGradient>
        <clipPath id={`${id}-c`}><rect x="6" y="20" width="52" height="24" rx="12" /></clipPath>
      </defs>
      <g transform="rotate(-38 32 32)">
        <g clipPath={`url(#${id}-c)`}>
          <rect x="6" y="20" width="26" height="24" fill={`url(#${id}-a)`} />
          <rect x="32" y="20" width="26" height="24" fill={`url(#${id}-b)`} />
          <rect x="6" y="20" width="52" height="9" fill="#fff" opacity=".22" />
        </g>
        <rect x="6" y="20" width="52" height="24" rx="12" fill="none" stroke="#0B1020" strokeOpacity=".25" />
        {animated ? (
          <motion.path d="M10 32h11l4-8 6 16 5-12 3 4h15" fill="none" stroke="#0B1020" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', times: [0, .5, .85, 1] }} />
        ) : (
          <path d="M10 32h11l4-8 6 16 5-12 3 4h15" fill="none" stroke="#0B1020" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </g>
    </svg>
  );
}

export function Wordmark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size * 1.6} />
      <span className="font-display font-semibold tracking-[.14em]" style={{ fontSize: size }}>MEDINEX</span>
    </span>
  );
}
