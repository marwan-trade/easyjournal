import { useState } from 'react';
import { tradesOf } from '../store.js';
import { summarize } from '../core/domain/stats.js';
import { MODE_LABELS } from '../core/domain/trade.js';
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
  const shown = realBalance(trades, cap); // argent actuel = dépôt + gains − pertes réels (même calcul que l'Excel)
  const net = shown - cap;
  const banner = (
<section className="deposit" aria-label="Argent actuel" style={{ '--i': 0 }}>
        <div>
          <div className="k">Argent actuel{settings.backtest ? ` · ${MODE_LABELS[settings.mode]}` : ''}</div>
          <div className="v">{cap > 0 ? money(shown, settings, { digits: 2 }) : '—'}</div>
          <div className="sub">{cap > 0 ? <>argent mis sur le compte {money(cap, settings, { digits: 2 })} · gagné / perdu <b className={signClass(net)}>{money(net, settings, { sign: true, digits: 2 })}</b></> : <>Dépôt non défini : <a href="#/profile">écris l'argent mis sur ton compte</a> pour voir ton argent actuel.</>}</div>
        </div>
        <a className="btn" href="#/profile">Modifier le dépôt</a>
      </section>
  );
  if (trades.length === 0) return <>{banner}<Empty title="Ton journal est vide" text="Ajoute ton premier trade ou importe ton Excel depuis les réglages." action="Ajouter un trade" onAction={onNew} demo /></>;

  // Courbe par défaut : la première qui a assez de points (argent, puis pips, puis +1/−1).
  const tab = chosen ?? ['money', 'pips', 'outcome'].find((k) => s.curves[k === 'money' ? 'equity' : k].length > 1) ?? 'outcome';
  const setTab = setChosen;
  const dd = s.money.drawdown;
  const noDeposit = !(cap > 0); // sans dépôt : aucun montant d'argent n'est affiché
  // Trades terminés sans pips ni solde : leur gain/perte compte 0 $, donc perte, profit factor et drawdown sont incomplets.
  const missing = Math.max(0, s.money.coverage.of - s.money.coverage.with);

  const fmtInt = (v) => formatNumber(v, { digits: 2 });
  const series = {
    money: { pts: s.curves.equity, fy: (v) => money(v, settings, { digits: 0 }), label: 'Capital' },
    pips: { pts: s.curves.pips, fy: (v) => formatNumber(v, { digits: 0, sign: true }), label: 'Pips cumulés' },
    outcome: { pts: s.curves.outcome, fy: (v) => formatNumber(v, { digits: 0, sign: true }), label: 'Gagnants moins perdants' },
  }[tab];
  const recent = [...trades].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 5);

  return (
    <>
      {banner}
      {!noDeposit && missing > 0 && <div className="remind" role="status"><span><b>{missing} trade(s) sans montant.</b> Ils n'ont ni pips ni solde réel : leur gain ou perte compte 0 $, donc la perte totale, le profit factor et le drawdown sont incomplets. Ajoute leurs pips ou leur solde dans le Journal.</span></div>}

      <section className="grid kpis">
        <div className="card" style={{ '--i': 1 }}><div className="k">Réussite</div>
          <div className="v">{s.winRate === null ? '—' : <CountUp value={s.winRate * 100} format={(v) => `${v.toFixed(1).replace('.', ',')} %`} />}</div>
          <div className="sub">{s.wins} gagnants · {s.losses} perdants</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Trades gagnants</div>
          <div className="v win"><CountUp value={s.wins} format={(v) => String(Math.round(v))} /></div>
          <div className="sub">{noDeposit || s.money.total === null ? 'montant masqué : dépôt non défini' : `gain estimé ≈ ${money(s.money.grossWin, settings, { sign: true, digits: 2 })}`}</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Trades perdants</div>
          <div className="v loss"><CountUp value={s.losses} format={(v) => String(Math.round(v))} /></div>
          <div className="sub">{noDeposit || s.money.total === null ? 'montant masqué : dépôt non défini' : `perte estimée ≈ ${money(-s.money.grossLoss, settings, { sign: true, digits: 2 })}${missing ? ' · incomplète' : ''}`}</div></div>
        <div className="card" style={{ '--i': 2 }}><div className="k">Profit factor</div>
          <div className="v">{s.money.profitFactor === null || missing > 0 ? '—' : s.money.profitFactor === Infinity ? '∞' : <CountUp value={s.money.profitFactor} format={fmtInt} />}</div>
          <div className="sub">{missing > 0 && !noDeposit ? 'incomplet : montants manquants' : 'gains ÷ pertes'}</div></div>
        <div className="card" style={{ '--i': 3 }}><div className="k">Pips</div>
          <div className={`v ${signClass(s.pips.total)}`}>{s.pips.total === null ? '—' : <CountUp value={s.pips.total} format={(v) => formatNumber(v, { digits: 1, sign: true })} />}</div>
          <div className="sub">{s.pips.coverage.with} / {s.pips.coverage.of} saisis</div></div>
        <div className="card" style={{ '--i': 4 }}><div className="k">Drawdown max</div>
          <div className="v loss">{dd && !noDeposit ? <CountUp value={-dd.amount} format={(v) => money(v, settings, { digits: 2 })} /> : '—'}</div>
          <div className="sub">{missing > 0 && !noDeposit ? 'incomplet : montants manquants' : dd?.pct != null ? `${formatPercent(dd.pct, 1)} du sommet` : s.open ? `${s.open} trade(s) en cours` : ' '}</div></div>
      </section>

      <section className="feature" style={{ '--i': 5 }}>
      <div className="card flat">
          <div className="card-head"><h2>Évolution</h2>
            <div className="seg sm" role="group" aria-label="Type de courbe">
              {[['money', 'Argent'], ['pips', 'Pips'], ['outcome', '+1 / −1']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
            </div></div>
          <LineChart key={tab} points={series.pts} formatY={series.fy} label={series.label} onSelect={onEdit} />
          <p className="chart-hint">Clique sur un point pour ouvrir le trade correspondant.</p>
        </div>
      </section>

      <section className="grid two">
        <div className="card" style={{ '--i': 6 }}>
          <h2>Par scénario</h2><div className="sub">Taux de réussite</div>
          {s.byScenario.length ? <RateBars rows={s.byScenario} /> : <p className="muted">Renseigne le scénario de tes trades pour voir cette répartition.</p>}
          <h3>Discipline</h3>
          <div className="sub">Règles respectées : {s.discipline.followed.winRate === null ? '—' : formatPercent(s.discipline.followed.winRate)} de réussite ({s.discipline.followed.total}) <br />Règles non respectées : {s.discipline.broken.winRate === null ? '—' : formatPercent(s.discipline.broken.winRate)} ({s.discipline.broken.total})</div>
        </div>
        <div className="card" style={{ '--i': 7 }}>
          <h2>Derniers trades</h2>
          <div className="tablewrap"><table><thead><tr><th>Date</th><th>Paire</th><th>Résultat</th><th className="num">Pips</th></tr></thead><tbody>
            {recent.map((t) => (
              <tr key={t.id} tabIndex={0} onClick={() => onEdit(t)} onKeyDown={(e) => e.key === 'Enter' && onEdit(t)}><td>{shortDate(t.date)}</td><td>{t.pair}</td><td><ResultPill result={t.result} /></td><td className="num">{pipsText(t)}</td></tr>))}
          </tbody></table></div>
        </div>
      </section>
    </>
  );
}
