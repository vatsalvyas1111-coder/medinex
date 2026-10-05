import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const G = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14b8a6" /><stop offset="1" stopColor="#6ee7b7" /></linearGradient>
    <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#fdba74" /></linearGradient>
    <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#f0abfc" /></linearGradient>
  </defs>
);
const float = (d = 0) => ({ animate: { y: [0, -6, 0] }, transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const, delay: d } });

export function EmptyMeds({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true"><G id="em" />
      <ellipse cx="100" cy="168" rx="66" ry="9" fill="rgb(var(--ink))" opacity=".08" />
      <motion.g {...float()}><rect x="52" y="60" width="96" height="100" rx="20" fill="rgb(var(--surface))" stroke="rgb(var(--ink))" strokeOpacity=".12" strokeWidth="2" />
        <rect x="52" y="60" width="96" height="30" rx="16" fill="url(#emt)" /><rect x="86" y="70" width="28" height="10" rx="5" fill="#fff" opacity=".7" />
        <path d="M76 124h48M100 100v48" stroke="url(#emt)" strokeWidth="9" strokeLinecap="round" /></motion.g>
      <motion.g {...float(1)}><circle cx="40" cy="60" r="10" fill="url(#emw)" /><circle cx="162" cy="84" r="7" fill="url(#emp)" /></motion.g>
      <motion.path d="M20 132c14 0 14-16 28-16s14 16 28 16" stroke="rgb(var(--teal))" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} />
    </svg>
  );
}
export function EmptyAlerts({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true"><G id="ea" />
      <ellipse cx="100" cy="170" rx="60" ry="8" fill="rgb(var(--ink))" opacity=".08" />
      <motion.g {...float()} style={{ originX: '100px', originY: '60px' }}>
        <path d="M100 38c-28 0-42 20-42 46v26l-12 20h108l-12-20V84c0-26-14-46-42-46z" fill="url(#eat)" />
        <path d="M76 66c4-10 14-16 24-16" stroke="#fff" strokeOpacity=".7" strokeWidth="6" strokeLinecap="round" />
        <path d="M86 146a14 14 0 0028 0" fill="url(#eaw)" /></motion.g>
      <motion.path d="M150 60c6 6 8 14 6 22M162 52c10 10 14 24 10 38" stroke="rgb(var(--teal))" strokeOpacity=".5" strokeWidth="3.5" strokeLinecap="round" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2.4, repeat: Infinity }} />
      <path d="M84 96l12 12 22-24" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function EmptyRequests({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true"><G id="er" />
      <ellipse cx="100" cy="170" rx="62" ry="8" fill="rgb(var(--ink))" opacity=".08" />
      <motion.g {...float()}><rect x="54" y="34" width="92" height="124" rx="16" fill="rgb(var(--surface))" stroke="rgb(var(--ink))" strokeOpacity=".12" strokeWidth="2" />
        <rect x="76" y="26" width="48" height="18" rx="9" fill="url(#ert)" />
        <path d="M70 72h60M70 92h60M70 112h36" stroke="rgb(var(--ink))" strokeOpacity=".14" strokeWidth="6" strokeLinecap="round" />
        <circle cx="132" cy="136" r="18" fill="url(#erw)" /><path d="M123 136l7 7 12-14" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></motion.g>
    </svg>
  );
}
export function NotFoundArt({ size = 260 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 300 210" fill="none" aria-hidden="true"><G id="nf" />
      <motion.path d="M10 120h70l14-30 22 70 20-52 12 12h152" stroke="rgb(var(--teal))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6 }} />
      <motion.g {...float()}><rect x="196" y="58" width="74" height="34" rx="17" fill="url(#nft)" transform="rotate(-24 233 75)" /><rect x="196" y="58" width="37" height="34" rx="17" fill="#fff" opacity=".35" transform="rotate(-24 233 75)" /></motion.g>
      <text x="150" y="196" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="44" fontWeight="600" fill="rgb(var(--ink))" opacity=".85">404</text>
    </svg>
  );
}
/** Onboarding hero: caregiver + patient linked by a heartbeat line. */
export function HeroLink({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 300" className={className} fill="none" aria-hidden="true"><G id="hl" />
      <ellipse cx="260" cy="270" rx="220" ry="14" fill="rgb(var(--ink))" opacity=".07" />
      {/* patient */}
      <motion.g {...float()}>
        <circle cx="96" cy="120" r="34" fill="url(#hlw)" /><path d="M62 112c4-24 24-32 42-28 18 4 26 18 24 30-10-10-30-14-44-10-8 2-16 6-22 8z" fill="#e5e7eb" />
        <rect x="52" y="160" width="88" height="86" rx="34" fill="url(#hlt)" /><circle cx="84" cy="122" r="3.2" fill="#3b2f2f" /><circle cx="108" cy="122" r="3.2" fill="#3b2f2f" /><path d="M86 134c6 6 16 6 22 0" stroke="#3b2f2f" strokeWidth="3" strokeLinecap="round" />
        <rect x="74" y="188" width="44" height="22" rx="11" fill="#fff" opacity=".9" /><rect x="74" y="188" width="22" height="22" rx="11" fill="#fca5a5" />
      </motion.g>
      {/* caregiver */}
      <motion.g {...float(1.2)}>
        <circle cx="424" cy="112" r="34" fill="url(#hlw)" /><path d="M392 108c2-28 40-38 60-14 6 8 6 18 2 24-6-14-26-22-42-16-8 2-16 6-20 6z" fill="#3b2f2f" />
        <rect x="380" y="152" width="88" height="94" rx="34" fill="url(#hlp)" /><circle cx="412" cy="116" r="3.2" fill="#3b2f2f" /><circle cx="436" cy="116" r="3.2" fill="#3b2f2f" /><path d="M414 128c6 6 16 6 22 0" stroke="#3b2f2f" strokeWidth="3" strokeLinecap="round" />
        <rect x="406" y="176" width="36" height="58" rx="8" fill="rgb(var(--surface))" stroke="rgb(var(--ink))" strokeOpacity=".2" /><circle cx="424" cy="196" r="10" fill="url(#hlt)" /><path d="M419 196l4 4 7-8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      {/* heartbeat link */}
      <motion.path d="M150 190h60l14-38 26 84 24-64 14 18h128" stroke="url(#hlt)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1] , opacity: [1, 1, 0.55] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.6 }} />
      <motion.circle r="7" fill="#fff" stroke="rgb(var(--teal))" strokeWidth="3" animate={{ cx: [150, 380], cy: [190, 190] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.6, ease: 'linear' }} />
      <motion.g animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ originX: '260px', originY: '70px' }}>
        <path d="M260 96c-30-20-44-36-44-52a24 24 0 0144-12 24 24 0 0144 12c0 16-14 32-44 52z" transform="translate(0 -6) scale(.6) translate(173 40)" fill="rgb(var(--coral))" opacity=".9" />
      </motion.g>
    </svg>
  );
}

export function EmptyState({ art, title, body, action }: { art: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center px-6 py-10 text-center">
      {art}
      <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
