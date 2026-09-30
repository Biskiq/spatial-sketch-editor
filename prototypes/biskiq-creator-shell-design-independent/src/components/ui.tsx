import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`} aria-label="Biskiq">
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m14 2 10 6v12l-10 6L4 20V8L14 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m4 8 10 6 10-6M14 14v12M14 2v7l-6 3.5M24 20l-6-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
    <span>biskiq<span className="brand-period">.</span></span>
  </div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`toggle ${checked ? 'checked' : ''}`}><span /></button>;
}

export function Dialog({ children, title, eyebrow, onClose, wide = false }: { children: ReactNode; title: string; eyebrow?: string; onClose: () => void; wide?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = dialogRef.current;
    (el?.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="radio"]), textarea, select') ?? el)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab' && el) {
        const focusables = el.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select, [tabindex="0"]');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <motion.div className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.2 }}>
      <div className="dialog-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
      {children}
    </motion.div>
  </motion.div>;
}

export function Toast({ message }: { message: string | null }) {
  return <AnimatePresence>{message && <motion.div className="toast" role="status" key={message} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><span className="toast-dot" />{message}</motion.div>}</AnimatePresence>;
}