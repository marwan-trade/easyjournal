/**
 * Statistiques. Fonctions pures : elles reçoivent des trades déjà filtrés (un seul mode)
 * et les réglages, et ne touchent ni au DOM ni au stockage.
 *
 * Conventions (identiques à ton Excel) :
 *  - taux de réussite = gagnants ÷ (gagnants + perdants), les égalités sont exclues ;
 *  - « trades terminés » = gagnants + perdants + égalités.
 */
import { compareTrades, isCompleted, signedPips } from './trade.js';
import { effectivePnl, rMultiple } from './money.js';

export const sortTrades = (trades) => [...trades].sort(compareTrades);

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : null);

function winRateOf(wins, losses) {
  return wins + losses === 0 ? null : wins / (wins + losses);
}

/** Série d'équité cumulée. Les trades sans montant sont ignorés (voir coverage). */
export function equityCurve(sorted, settings, initialCapital = 0) {
  let value = initialCapital;
  const points = [];
  for (const t of sorted) {
    if (!isCompleted(t)) continue;
    const p = effectivePnl(t, settings);
    if (!p) continue;
    value += p.value;
    points.push({ date: t.date, value, trade: t });
  }
  return points;
}

export function pipsCurve(sorted) {
  let value = 0;
  const points = [];
  for (const t of sorted) {
    if (!isCompleted(t)) continue;
    const p = signedPips(t);
    if (p === null) continue;
    value += p;
    points.push({ date: t.date, value, trade: t });
  }
  return points;
}

/** +1 par gagnant, −1 par perdant : disponible même sans pips ni argent. */
export function outcomeCurve(sorted) {
  let value = 0;
  const points = [];
  for (const t of sorted) {
    if (t.result === 'Gagnant') value += 1;
    else if (t.result === 'Perdant') value -= 1;
    else continue;
    points.push({ date: t.date, value, trade: t });
  }
  return points;
}

/** Plus forte baisse depuis un sommet. `base` sert au calcul du pourcentage. */
export function maxDrawdown(points, base = 0) {
  if (points.length === 0) return null;
  let peak = Math.max(base, points[0].value);
  let worst = 0;
  let worstPct = null;
  for (const { value } of points) {
    if (value > peak) peak = value;
    const dd = peak - value;
    if (dd > worst) {
      worst = dd;
      worstPct = peak > 0 ? dd / peak : null;
    }
  }
  return { amount: worst, pct: worstPct };
}

export function streaks(sorted) {
  let maxWin = 0;
  let maxLoss = 0;
  let cur = { type: null, count: 0 };
  for (const t of sorted) {
    if (t.result !== 'Gagnant' && t.result !== 'Perdant') continue; // égalités ignorées
    if (cur.type === t.result) cur.count += 1;
    else cur = { type: t.result, count: 1 };
    if (cur.type === 'Gagnant') maxWin = Math.max(maxWin, cur.count);
    else maxLoss = Math.max(maxLoss, cur.count);
  }
  return { maxWin, maxLoss, current: cur };
}

/** Regroupe les trades terminés par clé et calcule les indicateurs de chaque groupe. */
export function groupBy(trades, keyFn, settings) {
  const map = new Map();
  for (const t of trades) {
    if (!isCompleted(t)) continue;
    const key = keyFn(t);
    if (key === null || key === undefined || key === '') continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return [...map.entries()].map(([key, list]) => {
    const wins = list.filter((t) => t.result === 'Gagnant').length;
    const losses = list.filter((t) => t.result === 'Perdant').length;
    const pips = list.map(signedPips).filter((v) => v !== null);
    const pnls = list.map((t) => effectivePnl(t, settings)).filter(Boolean);
    return {
      key,
      total: list.length,
      wins,
      losses,
      breakeven: list.length - wins - losses,
      winRate: winRateOf(wins, losses),
      pips: pips.length ? sum(pips) : null,
      pnl: pnls.length ? sum(pnls.map((p) => p.value)) : null,
    };
  });
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Synthèse complète d'un ensemble de trades d'un même mode. */
export function summarize(trades, settings, initialCapital = 0) {
  const sorted = sortTrades(trades);
  const done = sorted.filter(isCompleted);
  const wins = done.filter((t) => t.result === 'Gagnant');
  const losses = done.filter((t) => t.result === 'Perdant');

  // Pips
  const pipsList = done.map((t) => ({ t, p: signedPips(t) })).filter((x) => x.p !== null);
  const winPips = pipsList.filter((x) => x.t.result === 'Gagnant').map((x) => x.p);
  const lossPips = pipsList.filter((x) => x.t.result === 'Perdant').map((x) => x.p);

  // Argent
  const moneyList = done.map((t) => ({ t, p: effectivePnl(t, settings) })).filter((x) => x.p);
  const grossWin = sum(moneyList.filter((x) => x.p.value > 0).map((x) => x.p.value));
  const grossLoss = sum(moneyList.filter((x) => x.p.value < 0).map((x) => -x.p.value));
  const rs = done.map((t) => rMultiple(t, settings)).filter((v) => v !== null);

  const equity = equityCurve(sorted, settings, initialCapital);
  const pipsPts = pipsCurve(sorted);
  const outcome = outcomeCurve(sorted);

  const ruled = (flag) => {
    const list = done.filter((t) => t.rulesFollowed === flag);
    const w = list.filter((t) => t.result === 'Gagnant').length;
    const l = list.filter((t) => t.result === 'Perdant').length;
    return { total: list.length, wins: w, losses: l, winRate: winRateOf(w, l) };
  };

  return {
    total: sorted.length,
    open: sorted.length - done.length,
    completed: done.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: done.length - wins.length - losses.length,
    winRate: winRateOf(wins.length, losses.length),

    pips: {
      total: pipsList.length ? sum(pipsList.map((x) => x.p)) : null,
      avgWin: mean(winPips),
      avgLoss: mean(lossPips),
      expectancy: pipsList.length ? mean(pipsList.map((x) => x.p)) : null,
      coverage: { with: pipsList.length, of: done.length },
    },

    money: {
      total: moneyList.length ? sum(moneyList.map((x) => x.p.value)) : null,
      estimatedCount: moneyList.filter((x) => x.p.estimated).length,
      profitFactor: moneyList.length === 0 ? null : grossLoss === 0 ? (grossWin > 0 ? Infinity : null) : grossWin / grossLoss,
      expectancy: moneyList.length ? mean(moneyList.map((x) => x.p.value)) : null,
      avgWin: mean(moneyList.filter((x) => x.p.value > 0).map((x) => x.p.value)),
      avgLoss: mean(moneyList.filter((x) => x.p.value < 0).map((x) => x.p.value)),
      drawdown: maxDrawdown(equity, initialCapital),
      coverage: { with: moneyList.length, of: done.length },
    },

    r: { expectancy: mean(rs), count: rs.length },

    curves: { equity, pips: pipsPts, outcome },
    streaks: streaks(sorted),
    discipline: { followed: ruled(true), broken: ruled(false), unknown: ruled(null) },

    byScenario: groupBy(sorted, (t) => t.scenario, settings).sort((a, b) => a.key.localeCompare(b.key, 'fr', { numeric: true })),
    byPair: groupBy(sorted, (t) => t.pair, settings).sort((a, b) => b.total - a.total),
    byTimeframe: groupBy(sorted, (t) => t.timeframe, settings).sort((a, b) => b.total - a.total),
    byWeekday: groupBy(sorted, (t) => weekdayOf(t.date), settings)
      .map((g) => ({ ...g, label: WEEKDAYS[g.key] }))
      .sort((a, b) => ((a.key + 6) % 7) - ((b.key + 6) % 7)), // lundi en premier
  };
}
