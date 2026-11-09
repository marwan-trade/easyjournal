import { useMemo } from 'react';
import { useCalendar } from '../useCalendar.js';
import { weekRange, upcoming, relativeTime, currenciesFromPairs } from '../core/calendar/events.js';
import Impact from './Impact.jsx';

const fmt = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`; };

/** Carte « Annonces à venir » du tableau de bord : impact moyen et fort, tes devises en premier. */
export default function Announcements({ state, i = 8 }) {
  const week = useMemo(() => weekRange(new Date(), 0), []);
  const next = useMemo(() => weekRange(new Date(), 1), []);
  const a = useCalendar(week.from, week.to);
  const b = useCalendar(next.from, next.to);
  const mine = currenciesFromPairs(state.trades.map((t) => t.pair));
  const all = [...a.events, ...b.events];
  const items = upcoming(all, new Date(), { impacts: ['high', 'medium'], limit: 40 });
  const sorted = [...items.filter((e) => mine.includes(e.currency)), ...items.filter((e) => !mine.includes(e.currency))]
    .sort((x, y) => (x.impact === y.impact ? (x.at < y.at ? -1 : 1) : x.impact === 'high' ? -1 : 1)).slice(0, 5)
    .sort((x, y) => (x.at < y.at ? -1 : 1));
  return (
    <div className="card" style={{ '--i': i }}>
      <div className="card-head"><h2>Annonces à venir</h2><a className="k" href="#/calendar" style={{ color: 'var(--gold)' }}>Calendrier complet →</a></div>
      {a.status === 'nokey' && <p className="sub">Connecte une source pour voir les annonces qui font bouger tes paires. <a href="#/calendar" style={{ color: 'var(--gold)' }}>Configurer</a></p>}
      {a.status === 'error' && <p className="sub">Annonces indisponibles : {a.error?.message}</p>}
      {a.status === 'loading' && <p className="sub">Chargement…</p>}
      {a.status === 'ok' && sorted.length === 0 && <p className="sub">Aucune annonce moyenne ou forte à venir.</p>}
      <ul className="annc">
        {sorted.map((e) => (
          <li key={e.id} className={e.impact}>
            <Impact level={e.impact} />
            <div><b>{e.currency}</b> · {e.title}<div className="sub">{fmt(e.at)} · {relativeTime(e.at)}{mine.includes(e.currency) ? ' · ta paire' : ''}</div></div>
          </li>
        ))}
      </ul>
      {a.demo && <p className="sub">Exemples fictifs.</p>}
    </div>
  );
}
