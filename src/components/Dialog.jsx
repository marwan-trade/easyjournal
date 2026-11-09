import { useEffect, useRef } from 'react';

/** Boîte de dialogue native <dialog> : focus géré, Échap pour fermer. */
export default function Dialog({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={title}>
      <div className="dlg-h"><h2>{title}</h2><button type="button" className="x" onClick={onClose} aria-label="Fermer">×</button></div>
      <div className="dlg-b">{children}</div>
      {footer && <div className="dlg-f">{footer}</div>}
    </dialog>
  );
}
