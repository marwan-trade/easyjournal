import { useState } from 'react';
import { tradesOf } from '../store.js';
import { PERIODS, periodRange, shiftAnchor, inPeriod, periodLabel, todayISO } from '../core/domain/period.js';
import { summarize } from '../core/domain/stats.js';
import { money, signClass, formatNumber, formatPercent } from '../format.js';
import { RateBars, Empty } from '../components/shared.jsx';

function Breakdown({ title, rows, settings, labelOf, i }) {
  if (!rows.length) return null;
  return (
    <div className="card" style={{ '--i': i }}>
      <h2>{title}</h2>
      <RateBars rows={rows} labelOf={labelOf} />
      <div className="tablewrap"><table><thead><tr><th>Groupe</th><th className="num">Trades</th><th className="num">G / P</th><th className="num">Pips</th><th className="num">Net</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.key} style={{ cursor: 'default' }}><td>{(labelOf ?? ((x) => x.key))(r)}</td><td className="num">{r.total}</td><td className="num">{r.wins} / {r.losses}</td>
          <td className={`num ${signClass(r.pips)}`}>{formatNumber(r.pips, { sign: true })}</td><td className={`num ${signClass(r.pnl)}`}>{r.pnl === null ? '—' : money(r.pnl, settings, { sign: true })}</td></tr>)}
      </tbody></table></div>
    </div>
  );
}

/** Choix de la période analysée : jour, semaine, mois, année ou tout, avec précédent / suivant. */
function PeriodBar({ kind, setKind, anchor, setAnchor, count }) {
  const isAll = kind === 'all';
  const today = todayISO();
  return (
    <section className="card periodbar" style={{ '--i': 0 }}>
      <div className="seg sm" role="group" aria-label="Période">
        {PERIODS.map(([k, l]) => <button key={k} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => { setKind(k); if (k !== 'all' && !anchor) setAnchor(today); }}>{l}</button>)}
      </div>
      <div className="pnavbar">
        <button type="button" className="btn" disabled={isAll} onClick={() => setAnchor(shiftAnchor(kind, anchor, -1))} aria-label="Période précédente">‹</button>
        <div className="plabel" aria-live="polite"><b>{periodLabel(kind, anchor)}</b><small>{count} trade{count > 1 ? 's' : ''}</small></div>
        <button type="button" className="btn" disabled={isAll} onClick={() => setAnchor(shiftAnchor(kind, anchor, 1))} aria-label="Période suivante">›</button>
        <button type="button" className="btn" disabled={isAll || periodRange(kind, anchor).from === periodRange(kind, today).from} onClick={() => setAnchor(today)}>Aujourd'hui</button>
      </div>
    </section>
  );
}

export default function Analysis({ state }) {
  const { settings } = state;
  const [kind, setKind] = useState('all');
  const [anchor, setAnchor] = useState(() => todayISO());
  const all = tradesOf(settings.mode);
  const range = periodRange(kind, anchor);
  const trades = all.filter((t) => inPeriod(t.date, range));
  const cap = settings.initialCapital[settings.mode] || 0;
  const s = summarize(trades, settings, cap);
  if (!all.length) return <Empty title="Pas encore d'analyse" text="Termine quelques trades pour voir tes statistiques ici." />;
  const bar = <PeriodBar kind={kind} setKind={setKind} anchor={anchor} setAnchor={setAnchor} count={trades.length} />;
  if (!s.completed) return <>{bar}<Empty title="Rien à analyser sur cette période" text={trades.length ? 'Les trades de cette période ne sont pas encore terminés.' : 'Aucun trade à cette date. Change de période avec les flèches ou choisis « Tout ».'} /></>;
  return (
    <>
      {bar}
      <section className="grid kpis">
        <div className="card" style={{ '--i': 0 }}><div className="k">Espérance (argent)</div><div className={`v ${signClass(s.money.expectancy)}`}>{s.money.expectancy === null ? '—' : money(s.money.expectancy, settings, { sign: true })}</div><div className="sub">par trade</div></div>
        <div className="card" style={{ '--i': 1 }}><div className="k">Gain moyen</div><div className="v win">{s.money.avgWin === null ? '—' : money(s.money.avgWin, settings)}</div><div className="sub">trades gagnants</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Perte moyenne</div><div className="v loss">{s.money.avgLoss === null ? '—' : money(s.money.avgLoss, settings)}</div><div className="sub">trades perdants</div></div>
        <div className="card" style={{ '--i': 3 }}><div className="k">Meilleure série</div><div className="v win">{s.streaks.maxWin}</div><div className="sub">gagnants d'affilée</div></div>
        <div className="card" style={{ '--i': 4 }}><div className="k">Pire série</div><div className="v loss">{s.streaks.maxLoss}</div><div className="sub">perdants d'affilée</div></div>
        <div className="card" style={{ '--i': 5 }}><div className="k">R moyen</div><div className="v">{s.r.expectancy === null ? '—' : formatNumber(s.r.expectancy, { digits: 2, sign: true })}</div><div className="sub">{s.r.count ? `sur ${s.r.count} trade(s) avec risque` : 'renseigne le risque'}</div></div>
      </section>
      <section className="grid half">
        <Breakdown i={6} title="Par scénario" rows={s.byScenario} settings={settings} />
        <Breakdown i={7} title="Par confirmation" rows={s.byTimeframe} settings={settings} />
        <Breakdown i={8} title="Par paire" rows={s.byPair} settings={settings} />
        <Breakdown i={9} title="Par jour de la semaine" rows={s.byWeekday} settings={settings} labelOf={(r) => r.label} />
      </section>
      <section className="card" style={{ '--i': 10 }}>
        <h2>Discipline</h2>
        <p className="sub">Comparaison de tes résultats selon que tu as respecté ou non tes règles.</p>
        <div className="grid half" style={{ marginTop: 12, marginBottom: 0 }}>
          {[['Règles respectées', s.discipline.followed], ['Règles non respectées', s.discipline.broken]].map(([l, d]) => (
            <div key={l}><div className="k">{l}</div><div className="v">{d.winRate === null ? '—' : formatPercent(d.winRate)}</div><div className="sub">{d.wins} gagnants · {d.losses} perdants · {d.total} trade(s)</div></div>
          ))}
        </div>
      </section>
    </>
  );
}
