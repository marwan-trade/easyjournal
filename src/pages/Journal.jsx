import { useMemo, useState } from 'react';
import { tradesOf } from '../store.js';
import { effectivePnl, realBalance, realAmount } from '../core/domain/money.js';
import { summarize } from '../core/domain/stats.js';
import { money, signClass, shortDate, formatNumber } from '../format.js';
import { ResultPill, Empty, pipsText } from '../components/shared.jsx';
import ShotViewer from '../components/ShotViewer.jsx';

const EMPTY = { q: '', pair: '', scenario: '', result: '', from: '', to: '' };

export default function Journal({ state, onNew, onEdit }) {
  const { settings } = state;
  const all = tradesOf(settings.mode);
  const [f, setF] = useState(EMPTY);
  const [shot, setShot] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const pairs = useMemo(() => [...new Set(all.map((t) => t.pair))].sort(), [all.length]);
  const scenarios = useMemo(() => [...new Set(all.map((t) => t.scenario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })), [all.length]);
  const q = f.q.trim().toLowerCase();
  const rows = all.filter((t) => (!f.pair || t.pair === f.pair) && (!f.scenario || t.scenario === f.scenario)
    && (!f.result || (f.result === '__open' ? !t.result : t.result === f.result))
    && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to)
    && (!q || `${t.notes} ${t.tags.join(' ')} ${t.pair} ${t.timeframe} ${t.scenario}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  // Colonne Solde : la valeur réelle que tu saisis pour chaque trade (comme dans l'Excel).
  const currentBalance = realBalance(all, settings.initialCapital[settings.mode] || 0);
  const cap0 = !((settings.initialCapital[settings.mode] || 0) > 0); // sans dépôt : montants masqués
  const sum = summarize(rows, settings);
  const lots = rows.reduce((a, t) => a + (t.lots ?? 0), 0);

  if (all.length === 0) return <Empty title="Ton journal est vide" text="Ajoute un trade, ou importe ton Excel depuis les réglages." action="Ajouter un trade" onAction={onNew} demo />;
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
      <div className="totals" aria-label="Totaux des trades affichés">
        <div><span className="k">Gagnants</span><b className="win">{sum.wins}</b></div>
        <div><span className="k">Perdants</span><b className="loss">{sum.losses}</b></div>
        <div><span className="k">Total gagné</span><b className="win">{cap0 ? '—' : money(sum.money.grossWin, settings, { sign: true })}</b></div>
        <div><span className="k">Total perdu</span><b className="loss">{cap0 ? '—' : money(-sum.money.grossLoss, settings, { sign: true })}</b></div>
        <div><span className="k">Net</span><b className={signClass(sum.money.total)}>{cap0 || sum.money.total === null ? '—' : money(sum.money.total, settings, { sign: true })}</b></div>
        <div><span className="k">Pips</span><b className={signClass(sum.pips.total)}>{formatNumber(sum.pips.total, { sign: true })}</b></div>
      </div>
      <p className="muted" aria-live="polite">{rows.length} trade(s) affiché(s) sur {all.length}{sum.open ? ` · ${sum.open} en cours` : ''}{sum.money.estimatedCount ? ` · ${sum.money.estimatedCount} montant(s) estimé(s) ≈` : ''}</p>
      {rows.length === 0 ? <p className="muted" style={{ padding: '16px 0' }}>Aucun trade ne correspond à ces filtres. <button className="btn" onClick={() => setF(EMPTY)}>Réinitialiser</button></p> : (
        <div className="tablewrap"><table className="jtable"><thead><tr><th>Date</th><th>Paire</th><th>Scénario</th><th>Sens</th><th>Timeframe de confirmation</th><th>Résultat</th><th>Règles respectées ?</th><th aria-label="Capture du graphique">Repère du graphique</th><th>Notes</th><th className="num">RR prévu</th><th className="num">Pips gagnés</th><th className="num">Lots</th><th className="num">Gain / perte estimé ($)</th><th className="num">Solde réel ($)</th></tr></thead><tbody>
          {rows.map((t) => { const p = effectivePnl(t, settings); return (
            <tr key={t.id} tabIndex={0} onClick={() => onEdit(t)} onKeyDown={(e) => e.key === 'Enter' && onEdit(t)}>
              <td>{shortDate(t.date)}</td><td>{t.pair}</td><td>{t.scenario || '—'}</td><td>{t.side || '—'}</td><td>{t.timeframe || '—'}</td>
              <td><ResultPill result={t.result} /></td>
              <td>{t.rulesFollowed === true ? 'Oui' : t.rulesFollowed === false ? 'Non' : '—'}</td>
              <td className="shotcell">{t.screenshot ? <button type="button" className="shotbtn" title="Voir la capture" aria-label={`Voir la capture du trade ${t.pair} du ${t.date}`} onClick={(e) => { e.stopPropagation(); setShot(t); }}>▣</button> : '—'}</td>
              <td className="notes" title={t.notes}>{t.notes || '—'}</td>
              <td className="num">{t.rr ? `1:${formatNumber(t.rr, { digits: 2 })}` : '—'}</td>
              <td className="num">{pipsText(t)}</td><td className="num">{t.lots ?? '—'}</td>
              <td className={`num ${signClass(p?.value)}`}>{p ? `${p.estimated ? '≈ ' : ''}${money(p.value, settings, { sign: true })}` : '—'}</td>
              <td className="num bal">{realAmount(t) === null ? '—' : money(realAmount(t), settings, { sign: true, digits: 2 })}</td></tr>); })}
        </tbody>
          <tfoot><tr>
            <td colSpan={5}><b>Total · {rows.length} trade(s)</b></td>
            <td><span className="win">{sum.wins} G</span> · <span className="loss">{sum.losses} P</span></td>
            <td colSpan={4} />
            <td className={`num ${signClass(sum.pips.total)}`}>{formatNumber(sum.pips.total, { sign: true })}</td>
            <td className="num">{formatNumber(lots, { digits: 2 })}</td>
            <td className={`num ${signClass(sum.money.total)}`}><b>{sum.money.total === null ? '—' : money(sum.money.total, settings, { sign: true })}</b></td>
            <td className="num bal" title="Argent actuel"><b>{cap0 ? '—' : money(currentBalance, settings, { digits: 2 })}</b></td>
          </tr></tfoot></table></div>
      )}
      {shot && <ShotViewer trade={shot} list={rows.filter((t) => t.screenshot)} onChange={setShot} onClose={() => setShot(null)} />}
    </div>
  );
}
