import { useEffect } from 'react';
import { ResultPill } from './shared.jsx';

/** Capture d'écran d'un trade en grand. Échap, clic dehors ou × pour fermer ; ← → pour passer au trade suivant. */
export default function ShotViewer({ trade, list = [], onChange, onClose }) {
  const i = list.findIndex((t) => t.id === trade.id);
  const go = (d) => { const n = list[i + d]; if (n && onChange) onChange(n); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); };
    addEventListener('keydown', onKey, true); return () => removeEventListener('keydown', onKey, true);
  });
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Capture d'écran du trade" onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <figcaption>
          <b>{trade.pair}</b> · {trade.date}{trade.side ? ` · ${trade.side}` : ''}{trade.scenario ? ` · ${trade.scenario}` : ''}{trade.timeframe ? ` · ${trade.timeframe}` : ''} <ResultPill result={trade.result} />
          {trade.notes && <small>{trade.notes}</small>}
        </figcaption>
        <img src={trade.screenshot} alt={`Capture du trade ${trade.pair} du ${trade.date}`} />
        <div className="vbar">
          <button type="button" className="btn" disabled={i <= 0} onClick={() => go(-1)}>← Précédent</button>
          <span className="muted">{i >= 0 ? `${i + 1} / ${list.length}` : ''}</span>
          <button type="button" className="btn" disabled={i < 0 || i >= list.length - 1} onClick={() => go(1)}>Suivant →</button>
          <button type="button" className="btn primary" onClick={onClose}>Fermer</button>
        </div>
      </figure>
    </div>
  );
}
