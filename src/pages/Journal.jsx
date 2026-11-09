import { useMemo, useState } from 'react';
import { tradesOf } from '../store.js';
import { effectivePnl } from '../core/domain/money.js';
import { money, signClass, shortDate } from '../format.js';
import { ResultPill, Empty, pipsText } from '../components/shared.jsx';

const EMPTY = { q: '', pair: '', scenario: '', result: '', from: '', to: '' };

export default function Journal({ state, onNew, onEdit }) {
  const { settings } = state;
  const all = tradesOf(settings.mode);
  const [f, setF] = useState(EMPTY);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const pairs = useMemo(() => [...new Set(all.map((t) => t.pair))].sort(), [all.length]);
  const scenarios = useMemo(() => [...new Set(all.map((t) => t.scenario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })), [all.length]);
  const q = f.q.trim().toLowerCase();
  const rows = all.filter((t) => (!f.pair || t.pair === f.pair) && (!f.scenario || t.scenario === f.scenario)
    && (!f.result || (f.result === '__open' ? !t.result : t.result === f.result))
    && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to)
    && (!q || `${t.notes} ${t.tags.join(' ')} ${t.pair} ${t.timeframe} ${t.scenario}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  if (all.length === 0) return <Empty title="Ton journal est vide" text="Ajoute un trade, ou importe ton Excel depuis les réglages." action="Ajouter un trade" onAction={onNew} />;
  return (
    <div className="card" style={{ '--i': 0 }}>
      <div className="filters">
        <input type="search" placeholder="Rechercher…" aria-label="Rechercher" value={f.q} onChange={set('q')} />
        <select aria-label="Paire" value={f.pair} onChange={set('pair')}><option value="">Toutes les paires</option>{pairs.map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Scénario" value={f.scenario} onChange={set('scenario')}><option value="">Tous les scénarios</option>{scenarios.map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Résultat" value={f.result} onChange={set('result')}><option value="">Tous les résultats</option><option>Gagnant</option><option>Perdant</option><option>À égalité</option><option value="__open">En cours</option></select>
        <input type="date" aria-label="Du" value={f.from} onChange={set('from')} />
        <input type="date" aria-label="Au" value={f.to} onChange={set('to')} />
      </div>
      <p className="muted" aria-live="polite">{rows.length} trade(s) affiché(s) sur {all.length}</p>
      {rows.length === 0 ? <p className="muted" style={{ padding: '16px 0' }}>Aucun trade ne correspond à ces filtres. <button className="btn" onClick={() => setF(EMPTY)}>Réinitialiser</button></p> : (
        <div className="tablewrap"><table><thead><tr><th>Date</th><th>Paire</th><th>Sens</th><th>Scénario</th><th>Confirmation</th><th>Résultat</th><th className="num">Lots</th><th className="num">Pips</th><th className="num">Net</th></tr></thead><tbody>
          {rows.map((t) => { const p = effectivePnl(t, settings); return (
            <tr key={t.id} tabIndex={0} onClick={() => onEdit(t)} onKeyDown={(e) => e.key === 'Enter' && onEdit(t)}>
              <td>{shortDate(t.date)}</td><td>{t.pair}</td><td>{t.side || '—'}</td><td>{t.scenario || '—'}</td><td>{t.timeframe || '—'}</td>
              <td><ResultPill result={t.result} /></td><td className="num">{t.lots ?? '—'}</td><td className="num">{pipsText(t)}</td>
              <td className={`num ${signClass(p?.value)}`}>{p ? `${p.estimated ? '≈ ' : ''}${money(p.value, settings, { sign: true })}` : '—'}</td></tr>); })}
        </tbody></table></div>
      )}
    </div>
  );
}
