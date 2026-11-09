import { IMPACT_LABELS } from '../core/calendar/events.js';

/** Trois barres : 1 = faible, 2 = moyen, 3 = très fort. */
export default function Impact({ level, showLabel = false }) {
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <span className={`impact ${level}`} title={`Impact ${IMPACT_LABELS[level].toLowerCase()}`}>
      <span className="bars3" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
      {showLabel ? <span>{IMPACT_LABELS[level]}</span> : <span className="sr">Impact {IMPACT_LABELS[level].toLowerCase()}</span>}
    </span>
  );
}
