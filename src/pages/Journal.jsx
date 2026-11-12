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

  if (all.length === 0) return <Empty title="Ton journal est vide" text="Ajoute un trade, ou importe ton Excel depuis les paramètres." action="Ajouter un trade" onAction={onNew} importLink />;
  return (
    <div className="card flat jcard" style={{ '--i': 0 }}>
      <div className="jbar">
        <input type="search" className="grow" placeholder="Rechercher (notes, paire, tag…)" aria-label="Rechercher" value={f.q} onChange={set('q')} />
        <select aria-label="Paire" value={f.pair} onChange={set('pair')}><option value="">Toutes les paires</option>{pairs.map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Scénario" value={f.scenario} onChange={set('scenario')}><option value="">Tous les scénarios</option>{scenarios.map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Résultat" value={f.result} onChange={set('result')}><option value="">Tous les résultats</option><option>Gagnant</option><option>Perdant</option><option>À égalité</option><option value="__open">En cours</option></select>
        <span className="range"><input type="date" aria-label="Du" value={f.from} onChange={set('from')} /><i aria-hidden="true">→</i><input type="date" aria-label="Au" value={f.to} onChange={set('to')} /></span>
        {JSON.stringify(f) !== JSON.stringify(EMPTY) && <button type="button" className="btn" onClick={() => setF(EMPTY)}>Réinitialiser</button>}
      </div>
      <dl className="jstats" aria-label="Totaux des trades affichés">
        <div><dt>Trades</dt><dd>{rows.length}<small> / {all.length}</small></dd></div>
        <div><dt>Gagnants</dt><dd className="win">{sum.wins}</dd></div>
        <div><dt>Perdants</dt><dd className="loss">{sum.losses}</dd></div>
        <div><dt>Pips</dt><dd className={signClass(sum.pips.total)}>{formatNumber(sum.pips.total, { sign: true })}</dd></div>
        {!cap0 && <div><dt>Total gagné</dt><dd className="win">{money(sum.money.grossWin, settings, { sign: true })}</dd></div>}
        {!cap0 && <div><dt>Total perdu</dt><dd className="loss">{money(-sum.money.grossLoss, settings, { sign: true })}</dd></div>}
        {!cap0 && sum.money.total !== null && <div><dt>Net</dt><dd className={signClass(sum.money.total)}>{money(sum.money.total, settings, { sign: true })}</dd></div>}
      </dl>
      <p className="muted jnote" aria-live="polite">{sum.open ? `${sum.open} en cours` : ''}{sum.open && sum.money.estimatedCount && !cap0 ? ' · ' : ''}{sum.money.estimatedCount && !cap0 ? `${sum.money.estimatedCount} montant(s) estimé(s) ≈` : ''}</p>
      {rows.length === 0 ? <p className="muted" style={{ padding: '16px 0' }}>Aucun trade ne correspond à ces filtres. <button className="btn" onClick={() => setF(EMPTY)}>Réinitialiser</button></p> : (<>
        <ul className="jcards" aria-label="Trades">
          {rows.map((t) => { const p = effectivePnl(t, settings); const amt = cap0 || !p ? null : `${p.estimated ? '≈ ' : ''}${money(p.value, settings, { sign: true })}`; return (
            <li key={t.id}><div className="jcard" role="button" tabIndex={0} onClick={() => onEdit(t)} onKeyDown={(e) => e.key === 'Enter' && onEdit(t)}>
              <div className="jc1"><b>{t.pair}</b>{t.side && <span className="muted"> · {t.side}</span>}<span className={`jcp ${signClass(p?.value)}`}>{amt ?? pipsText(t)}</span></div>
              <div className="jc2"><span>{shortDate(t.date)}{t.timeframe ? ` · ${t.timeframe}` : ''}{t.scenario ? ` · ${t.scenario}` : ''}</span><ResultPill result={t.result} /></div>
              <div className="jc3 muted"><span>{pipsText(t)} pips{t.lots ? ` · lot ${t.lots}` : ''}{t.rr ? ` · RR 1:${formatNumber(t.rr, { digits: 2 })}` : ''}</span>{t.rulesFollowed !== undefined && t.rulesFollowed !== null && <span>{t.rulesFollowed ? '✔ Règles' : '✘ Règles'}</span>}{t.screenshot && <button type="button" className="shotbtn" aria-label={`Voir la capture du trade ${t.pair}`} onClick={(e) => { e.stopPropagation(); setShot(t); }}>▣</button>}</div>
            </div></li>); })}
        </ul>
        <div className="tablewrap jscroll"><table className="jtable"><thead><tr><th>Date</th><th>Paire</th><th>Scénario</th><th>Sens</th><th>Timeframe</th><th>Résultat</th><th>Règles</th><th aria-label="Capture du graphique">Graphique</th><th>Notes</th><th className="num">RR</th><th className="num">Pips</th><th className="num">Lots</th><th className="num">Estimé</th><th className="num">Solde réel</th></tr></thead><tbody>
          {rows.map((t) => { const p = effectivePnl(t, settings); return (
            <tr key={t.id} tabIndex={0} onClick={() => onEdit(t)} onKeyDown={(e) => e.key === 'Enter' && onEdit(t)}>
              <td>{shortDate(t.date)}</td><td>{t.pair}</td><td>{t.scenario || '—'}</td><td>{t.side || '—'}</td><td>{t.timeframe || '—'}</td>
              <td><ResultPill result={t.result} /></td>
              <td>{t.rulesFollowed === true ? 'Oui' : t.rulesFollowed === false ? 'Non' : '—'}</td>
              <td className="shotcell">{t.screenshot ? <button type="button" className="shotbtn" title="Voir la capture" aria-label={`Voir la capture du trade ${t.pair} du ${t.date}`} onClick={(e) => { e.stopPropagation(); setShot(t); }}>▣</button> : '—'}</td>
              <td className="notes" title={t.notes}>{t.notes || '—'}</td>
              <td className="num">{t.rr ? `1:${formatNumber(t.rr, { digits: 2 })}` : '—'}</td>
              <td className="num">{pipsText(t)}</td><td className="num">{t.lots ?? '—'}</td>
              <td className={`num ${signClass(p?.value)}`}>{p && !cap0 ? `${p.estimated ? '≈ ' : ''}${money(p.value, settings, { sign: true })}` : '—'}</td>
              <td className="num bal">{cap0 || realAmount(t) === null ? '—' : money(realAmount(t), settings, { sign: true, digits: 2 })}</td></tr>); })}
        </tbody>
          <tfoot><tr>
            <td colSpan={5}><b>Total · {rows.length} trade(s)</b></td>
            <td><span className="win">{sum.wins} G</span> · <span className="loss">{sum.losses} P</span></td>
            <td colSpan={4} />
            <td className={`num ${signClass(sum.pips.total)}`}>{formatNumber(sum.pips.total, { sign: true })}</td>
            <td className="num">{formatNumber(lots, { digits: 2 })}</td>
            <td className={`num ${signClass(sum.money.total)}`}><b>{cap0 || sum.money.total === null ? '—' : money(sum.money.total, settings, { sign: true })}</b></td>
            <td className="num bal" title="Argent actuel"><b>{cap0 ? '—' : money(currentBalance, settings, { digits: 2 })}</b></td>
          </tr></tfoot></table></div>
      </>)}
      {shot && <ShotViewer trade={shot} list={rows.filter((t) => t.screenshot)} onChange={setShot} onClose={() => setShot(null)} />}
    </div>
  );
}
