import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { spring } from '../lib/motion';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={spring}
            className={`glass max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] p-5 shadow-lift sm:rounded-xl2 sm:p-7 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`} style={{ background: 'rgb(var(--surface) / .92)' }}>
            <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-display text-2xl font-semibold">{title}</h2>
              <button className="btn-icon" onClick={onClose} aria-label="Close dialog"><X className="h-5 w-5" /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
