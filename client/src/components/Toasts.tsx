import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BellRing, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUI } from '../lib/store';
import { springBouncy } from '../lib/motion';

const ICON = { success: CheckCircle2, info: Info, warn: AlertTriangle, error: XCircle, alert: BellRing };
const TONE = { success: 'text-leaf', info: 'text-teal', warn: 'text-amber', error: 'text-coral', alert: 'text-coral' };

/** Sound-free toasts. Top-center on phones, top-right on larger screens. */
export function Toasts() {
  const { toasts, dismiss } = useUI();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5" role="region" aria-label="Notifications" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: -24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.95 }} transition={springBouncy}
              className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-3.5 shadow-lift">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${TONE[t.kind]}`} strokeWidth={2.2} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-snug">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                {t.action && <button className="mt-2 rounded-lg bg-teal/15 px-3 py-1.5 text-sm font-bold text-teal hover:bg-teal/25" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>{t.action.label}</button>}
              </div>
              <button aria-label="Dismiss notification" className="rounded-lg p-1.5 text-muted hover:bg-ink/10" onClick={() => dismiss(t.id)}><X className="h-4 w-4" /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
