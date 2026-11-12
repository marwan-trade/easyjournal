/**
 * Données FICTIVES de démonstration. Toutes les lignes ont un identifiant « demo-… »
 * pour pouvoir être supprimées d'un clic sans toucher aux vrais trades.
 */
import { normalizeTrade, todayISO } from './domain/trade.js';

export const DEMO_PREFIX = 'demo-';
export const isDemo = (t) => String(t.id).startsWith(DEMO_PREFIX);

function rng(seed) { // petit générateur déterministe : mêmes données à chaque fois
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NOTES_W = ['Setup propre, confirmation attendue.', 'Patience récompensée, SL bien placé.', 'Respecté le plan du début à la fin.', 'Entrée après le BOS, sortie partielle à 1:1.'];
const NOTES_L = ['Entrée trop tôt avant la confirmation.', 'Stop touché, le marché a changé de direction.', 'Zone trop large, il fallait réduire le risque.', 'Perte normale, le setup était valide.'];
const TFS = ['3min BOS', '5min BOS', '15min BOS', '15min/5min BOS', '45min BOS'];

function make(mode, n, daysBack, pairs, withMoney, rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now); d.setDate(d.getDate() - Math.round(((n - i) / n) * daysBack));
    if (d.getDay() === 0) d.setDate(d.getDate() - 2); if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    const rules = rand() < 0.85;
    const win = rand() < (rules ? 0.62 : 0.3);
    const lots = pick([0.1, 0.2, 0.3, 0.5]);
    const rr = pick([1, 1.5, 2]);
    const t = {
      id: `${DEMO_PREFIX}${mode}-${i}`, mode, date: todayISO(d), pair: pick(pairs), side: pick(['Achat', 'Vente']),
      scenario: pick(['Scénario 1', 'Scénario 1', 'Scénario 1', 'Scénario 2', 'Scénario 2', 'Scénario 3']),
      timeframe: pick(TFS), result: win ? 'Gagnant' : 'Perdant', rulesFollowed: rules, rr, lots,
      pips: Math.round((win ? 25 + rand() * 55 : 15 + rand() * 15) * 10) / 10,
      notes: pick(win ? NOTES_W : NOTES_L) + (rules ? '' : ' Règle non respectée.'), tags: ['démo'],
      createdAt: d.getTime() + i, updatedAt: d.getTime() + i,
    };
    if (withMoney) {
      const risk = pick([20, 30, 40, 50]);
      t.risk = risk;
      t.pnl = Math.round((win ? risk * rr * (0.8 + rand() * 0.35) : risk * (0.9 + rand() * 0.15)) * 100) / 100;
      t.fees = Math.round(lots * 3.5 * 100) / 100;
    }
    out.push(t);
  }
  return out;
}

/** 42 trades de backtest + 18 trades réels (le dernier est « en cours »). */
export function demoTrades({ backtest = false } = {}) {
  const rand = rng(7);
  const bt = backtest ? make('backtest', 42, 130, ['GBPUSD', 'EURUSD', 'USDJPY'], false, rand) : [];
  const real = make('reel', 18, 56, ['GBPUSD', 'EURUSD', 'USDJPY', 'AUDCAD'], true, rand);
  Object.assign(real[real.length - 1], { result: '', pips: null, pnl: null, rulesFollowed: null, notes: 'Trade en cours.' });
  return [...bt, ...real].map((t) => normalizeTrade(t));
}
