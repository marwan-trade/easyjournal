import { useState } from 'react';
import { tradesOf } from '../store.js';
import { summarize } from '../core/domain/stats.js';
import { effectivePnl, realBalance } from '../core/domain/money.js';
import { money, signClass, formatNumber, formatPercent, shortDate } from '../format.js';
import CountUp from '../components/CountUp.jsx';
import LineChart from '../components/LineChart.jsx';
import { ResultPill, RateBars, Empty, pipsText } from '../components/shared.jsx';

export default function Dashboard({ state, onNew, onEdit }) {
  const { settings } = state;
  const trades = tradesOf(settings.mode);
  const cap = settings.initialCapital[settings.mode] || 0;
  const s = summarize(trades, settings, cap); // calcul léger : recalculé à chaque changement de l'état
  const [chosen, setChosen] = useState(null);
  if (trades.length === 0) return <Empty title="Ton journal est vide" text="Ajoute ton premier trade ou importe ton Excel depuis les réglages." action="Ajouter un trade" onAction={onNew} demo />;

  // Courbe par défaut : la première qui a assez de points (argent, puis pips, puis +1/−1).
  const tab = chosen ?? ['money', 'pips', 'outcome'].find((k) => s.curves[k === 'money' ? 'equity' : k].length > 1) ?? 'outcome';
  const setTab = setChosen;
  const dd = s.money.drawdown;
  const real = realBalance(trades); // solde réel saisi par l'utilisateur (dernier trade qui en a un)
  const net = s.money.total ?? 0;
  const balance = real ?? cap + net;
  const fmtInt = (v) => formatNumber(v, { digits: 2 });
  const series = {
    money: { pts: s.curves.equity, fy: (v) => money(v, settings, { digits: 0 }), label: 'Capital' },
    pips: { pts: s.curves.pips, fy: (v) => formatNumber(v, { digits: 0, sign: true }), label: 'Pips cumulés' },
    outcome: { pts: s.curves.outcome, fy: (v) => formatNumber(v, { digits: 0, sign: true }), label: 'Gagnants moins perdants' },
  }[tab];
  const recent = [...trades].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 5);

  return (
    <>
      <section className="deposit" aria-label="Argent en dépôt" style={{ '--i': 0 }}>
        <div>
          <div className="k">Argent en dépôt</div>
          <div className="v">{cap > 0 ? <CountUp value={cap} format={(v) => money(v, settings, { digits: 2 })} /> : '—'}</div>
          <div className="sub">{cap > 0 ? 'somme déposée sur ton compte de trading' : <>Pas encore défini : <a href="#/settings">indique-le dans les Réglages</a></>}</div>
        </div>
        <a className="btn" href="#/settings">Modifier</a>
      </section>

      <section className="hero" aria-label="Solde et résultat">
        <div className="card main" style={{ '--i': 0 }}>
          <div className="k"><span>Solde actuel{real !== null ? ' · réel' : ''}</span></div>
          <div className="v"><CountUp value={balance} format={(v) => money(v, settings, { digits: 2 })} /></div>
          <div className="sub">{real !== null ? 'dernier solde réel que tu as saisi' : cap > 0 ? 'estimation : argent en dépôt + gain estimé (saisis ton solde réel dans un trade)' : 'saisis ton solde réel dans un trade'}</div>
        </div>
      </section>

      <section className="grid kpis">
        <div className="card" style={{ '--i': 1 }}><div className="k">Réussite</div>
          <div className="v">{s.winRate === null ? '—' : <CountUp value={s.winRate * 100} format={(v) => `${v.toFixed(1).replace('.', ',')} %`} />}</div>
          <div className="sub">{s.wins} gagnants · {s.losses} perdants</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Trades gagnants</div>
          <div className="v win"><CountUp value={s.wins} format={(v) => String(Math.round(v))} /></div>
          <div className="sub">{s.money.total === null ? 'gain estimé : —' : `gain estimé ≈ ${money(s.money.grossWin, settings, { sign: true, digits: 2 })}`}</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Trades perdants</div>
          <div className="v loss"><CountUp value={s.losses} format={(v) => String(Math.round(v))} /></div>
          <div className="sub">{s.money.total === null ? 'perte estimée : —' : `perte estimée ≈ ${money(-s.money.grossLoss, settings, { sign: true, digits: 2 })}`}</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Profit factor</div>
          <div className="v">{s.money.profitFactor === null ? '—' : s.money.profitFactor === Infinity ? '∞' : <CountUp value={s.money.profitFactor} format={fmtInt} />}</div>
          <div className="sub">gains ÷ pertes</div></div>
        <div className="card" style={{ '--i': 3 }}><div className="k">Pips</div>
          <div className={`v ${signClass(s.pips.total)}`}>{s.pips.total === null ? '—' : <CountUp value={s.pips.total} format={(v) => formatNumber(v, { digits: 1, sign: true })} />}</div>
          <div className="sub">{s.pips.coverage.with} / {s.pips.coverage.of} saisis</div></div>
        <div className="card" style={{ '--i': 4 }}><div className="k">Drawdown max</div>
          <div className="v loss">{dd ? <CountUp value={-dd.amount} format={(v) => money(v, settings, { digits: 2 })} /> : '—'}</div>
          <div className="sub">{dd?.pct != null ? `${formatPercent(dd.pct, 1)} du sommet` : s.open ? `${s.open} trade(s) en cours` : ' '}</div></div>
      </section>

      <section className="grid two">
        <div className="card" style={{ '--i': 5 }}>
          <div className="card-head"><h2>Évolution</h2>
            <div className="seg sm" role="group" aria-label="Type de courbe">
              {[['money', 'Argent'], ['pips', 'Pips'], ['outcome', '+1 / −1']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
            </div></div>
          <LineChart key={tab} points={series.pts} formatY={series.fy} label={series.label} />
        </div>
        <div className="card" style={{ '--i': 6 }}>
          <h2>Par scénario</h2><div className="sub">Taux de réussite</div>
          {s.byScenario.length ? <RateBars rows={s.byScenario} /> : <p className="muted">Renseigne le scénario de tes trades pour voir cette répartition.</p>}
          <h3>Discipline</h3>
          <div className="sub">Règles respectées : {s.discipline.followed.winRate === null ? '—' : formatPercent(s.discipline.followed.winRate)} de réussite ({s.discipline.followed.total}) <br />Règles non respectées : {s.discipline.broken.winRate === null ? '—' : formatPercent(s.discipline.broken.winRate)} ({s.discipline.broken.total})</div>
        </div>
      </section>

      <section className="card" style={{ '--i': 7 }}>
        <h2>Derniers trades</h2>
        <div className="tablewrap"><table><thead><tr><th>Date</th><th>Paire</th><th>Scénario</th><th>Résultat</th><th className="num">Pips</th><th className="num">Net</th></tr></thead><tbody>
          {recent.map((t) => { const p = effectivePnl(t, settings); return (
            <tr key={t.id} onClick={() => onEdit(t)}><td>{shortDate(t.date)}</td><td>{t.pair}</td><td>{t.scenario || '—'}</td><td><ResultPill result={t.result} /></td><td className="num">{pipsText(t)}</td>
              <td className={`num ${signClass(p?.value)}`}>{p ? `${p.estimated ? '≈ ' : ''}${money(p.value, settings, { sign: true })}` : '—'}</td></tr>); })}
        </tbody></table></div>
      </section>
    </>
  );
}
