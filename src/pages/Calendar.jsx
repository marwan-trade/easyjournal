import { useState, useMemo } from 'react';
import { useCalendar } from '../useCalendar.js';
import { IMPACTS, IMPACT_LABELS, MAJOR_CURRENCIES, filterEvents, groupByDay, weekRange, currenciesFromPairs, relativeTime } from '../core/calendar/events.js';
import { setDemoCalendar, isDemoCalendar } from '../core/calendar/cache.js';
import Impact from '../components/Impact.jsx';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const dayLabel = (iso) => { const [y, m, d] = iso.split('-').map(Number); const s = new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
const hour = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Calendar({ state }) {
  const [offset, setOffset] = useState(0);
  const [impacts, setImpacts] = useState(() => load('easyjournal.calImpacts', ['medium', 'high']));
  const [cur, setCur] = useState(() => load('easyjournal.calCurrencies', []));
  const { from, to } = useMemo(() => weekRange(new Date(), offset), [offset]);
  const cal = useCalendar(from, to);
  const myCurrencies = useMemo(() => currenciesFromPairs(state.trades.map((t) => t.pair)), [state.trades.length]);

  const toggle = (list, setList, k, v) => { const n = list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; setList(n); save(k, n); };
  const events = filterEvents(cal.events, { impacts, currencies: cur });
  const groups = groupByDay(events);
  const today = todayStr();
  const now = new Date();
  const nextId = events.find((e) => new Date(e.at) >= now)?.id;
  const weekLabel = `${new Date(from + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${new Date(to + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <>
      <div className="card" style={{ '--i': 0, marginBottom: 16 }}>
        <div className="card-head">
          <div className="row">
            <button className="btn" onClick={() => setOffset((o) => o - 1)} aria-label="Semaine précédente">‹</button>
            <button className="btn" onClick={() => setOffset(0)} disabled={offset === 0}>Cette semaine</button>
            <button className="btn" onClick={() => setOffset((o) => o + 1)} aria-label="Semaine suivante">›</button>
            <b style={{ marginLeft: 6 }}>{weekLabel}</b>
          </div>
          <button className="btn" onClick={cal.refresh} disabled={cal.demo || cal.status === 'nokey'}>Actualiser</button>
        </div>
        <div className="chips" role="group" aria-label="Filtrer par impact">
          <span className="k">Impact</span>
          {IMPACTS.map((i) => <button key={i} className={`chip ${impacts.includes(i) ? 'on' : ''}`} aria-pressed={impacts.includes(i)} onClick={() => toggle(impacts, setImpacts, 'easyjournal.calImpacts', i)}><Impact level={i} />{IMPACT_LABELS[i]}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Filtrer par devise">
          <span className="k">Devise</span>
          <button className={`chip ${cur.length === 0 ? 'on' : ''}`} aria-pressed={cur.length === 0} onClick={() => { setCur([]); save('easyjournal.calCurrencies', []); }}>Toutes</button>
          {myCurrencies.length > 0 && <button className="chip" title="Les devises de tes paires" onClick={() => { setCur(myCurrencies); save('easyjournal.calCurrencies', myCurrencies); }}>Mes paires</button>}
          {MAJOR_CURRENCIES.map((c) => <button key={c} className={`chip ${cur.includes(c) ? 'on' : ''}`} aria-pressed={cur.includes(c)} onClick={() => toggle(cur, setCur, 'easyjournal.calCurrencies', c)}>{c}</button>)}
        </div>
        <p className="sub" style={{ marginTop: 10 }}>Les heures sont affichées dans le fuseau de cet appareil.</p>
      </div>

      {cal.demo && <div className="banner" style={{ marginBottom: 16 }}>Exemples fictifs pour voir la mise en page. <button className="btn" onClick={() => { setDemoCalendar(false); location.reload(); }}>Quitter les exemples</button></div>}

      {cal.status === 'nokey' && (
        <div className="card empty" style={{ '--i': 1 }}>
          <h2>Connecte une source d'annonces</h2>
          <p>Il faut une clé API gratuite pour charger les vraies annonces économiques. Ça prend 2 minutes, la marche à suivre est dans les réglages.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn primary" href="#/settings" style={{ textDecoration: 'none' }}>Ajouter ma clé</a>
            <button className="btn" onClick={() => { setDemoCalendar(true); location.reload(); }}>Voir avec des exemples</button>
          </div>
        </div>
      )}
      {cal.status === 'loading' && <p className="muted" role="status">Chargement des annonces…</p>}
      {cal.status === 'error' && (
        <div className="card" style={{ '--i': 1 }}><h2>Impossible de charger le calendrier</h2><p className="banner" role="alert" style={{ marginTop: 8 }}>{cal.error?.message ?? 'Erreur inconnue.'}</p>
          <div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={cal.refresh}>Réessayer</button><a className="btn" href="#/settings" style={{ textDecoration: 'none' }}>Vérifier ma clé</a></div></div>
      )}
      {cal.status === 'ok' && groups.length === 0 && <div className="card empty"><h2>Aucune annonce</h2><p>Rien ne correspond à ces filtres cette semaine. Essaie d'ajouter « Faible » ou d'autres devises.</p></div>}
      {cal.status === 'ok' && groups.map((g, gi) => (
        <section className="card" key={g.day} style={{ '--i': gi + 1, marginBottom: 16 }}>
          <h2>{dayLabel(g.day)}{g.day === today && <span className="pill o" style={{ marginLeft: 10 }}>Aujourd'hui</span>}</h2>
          <div className="tablewrap"><table><thead><tr><th>Heure</th><th>Devise</th><th>Annonce</th><th>Impact</th><th className="num">Précédent</th><th className="num">Prévu</th><th className="num">Réel</th></tr></thead><tbody>
            {g.events.map((e) => {
              const past = new Date(e.at) < now;
              return (
                <tr key={e.id} style={{ cursor: 'default', opacity: past ? 0.62 : 1 }} className={e.id === nextId ? 'next' : ''}>
                  <td>{hour(e.at)}{e.id === nextId && <span className="soon">{relativeTime(e.at)}</span>}</td><td><b>{e.currency || '—'}</b></td>
                  <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{e.title}</td><td><Impact level={e.impact} showLabel /></td>
                  <td className="num">{e.previous ?? '—'}</td><td className="num">{e.forecast ?? '—'}</td><td className="num"><b>{e.actual ?? '—'}</b></td>
                </tr>
              );
            })}
          </tbody></table></div>
        </section>
      ))}
    </>
  );
}
