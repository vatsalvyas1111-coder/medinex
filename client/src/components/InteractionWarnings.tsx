import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { AllergyFlag, InteractionFlag } from '../lib/types';

const SEV: Record<string, string> = { major: 'border-coral/50 bg-coral/12 text-coral', moderate: 'border-amber/50 bg-amber/12 text-amber', minor: 'border-line/20 bg-ink/6 text-muted' };

export function InteractionWarnings({ interactions, allergies, checked }: { interactions: InteractionFlag[]; allergies: AllergyFlag[]; checked?: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {(interactions.length > 0 || allergies.length > 0) ? (
        <motion.div key="warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden" role="alert">
          {allergies.map((a) => <div key={a.allergy} className="flex gap-2.5 rounded-2xl border border-coral/50 bg-coral/12 p-3 text-sm font-semibold text-coral"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><span><b>Allergy warning:</b> {a.note}</span></div>)}
          {interactions.map((f) => <div key={f.with} className={`flex gap-2.5 rounded-2xl border p-3 text-sm ${SEV[f.severity]}`}><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span><b>{f.severity[0].toUpperCase() + f.severity.slice(1)} interaction with {f.with}.</b> <span className="font-medium text-ink/80">{f.note}</span> <span className="font-medium text-ink/70">Please confirm with a doctor or pharmacist.</span></span></div>)}
        </motion.div>
      ) : checked ? (
        <motion.p key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm font-semibold text-leaf"><ShieldCheck className="h-4 w-4" />No known interactions or allergy matches in our list.</motion.p>
      ) : null}
    </AnimatePresence>
  );
}
