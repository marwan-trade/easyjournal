import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrade, validateTrade, parseNum, applyResultSign, isValidISODate } from '../src/core/domain/trade.js';
import { effectivePnl, realBalance, rMultiple, pipValueFor, formatMoney } from '../src/core/domain/money.js';
import { summarize, maxDrawdown, streaks, sortTrades } from '../src/core/domain/stats.js';
import { mergeSettings } from '../src/core/store/settings.js';

const settings = { currency: 'USD', defaultPipValue: 10, pipValues: { USDJPY: 6.5 } };
let n = 0;
const mk = (o) => normalizeTrade({ date: '2026-01-01', pair: 'GBPUSD', createdAt: ++n, ...o });

test('parseNum accepte la virgule décimale et rejette le reste', () => {
  assert.equal(parseNum('1,5'), 1.5);
  assert.equal(parseNum(' 44.5 '), 44.5);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum(null), null);
});

test('dates : validation stricte', () => {
  assert.equal(isValidISODate('2026-02-29'), false);
  assert.equal(isValidISODate('2026-02-28'), true);
  assert.equal(isValidISODate('28/02/2026'), false);
});

test('normalizeTrade nettoie paire, résultat, tags et nombres', () => {
  const t = normalizeTrade({ pair: 'gbp/usd ', result: 'Gagnant', pips: '44,5', tags: 'a, b,,c', rulesFollowed: 'x' });
  assert.equal(t.pair, 'GBPUSD');
  assert.equal(t.pips, 44.5);
  assert.deepEqual(t.tags, ['a', 'b', 'c']);
  assert.equal(t.rulesFollowed, null);
});

test('validateTrade signale les champs invalides', () => {
  const bad = validateTrade(mk({ pair: '', date: 'x', lots: -1 }));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.pair && bad.errors.date && bad.errors.lots);
  assert.equal(validateTrade(mk({ lots: 0.5 })).ok, true);
});

test('le signe vient du résultat', () => {
  assert.equal(applyResultSign(45, 'Perdant'), -45);
  assert.equal(applyResultSign(-45, 'Gagnant'), 45);
  assert.equal(applyResultSign(12, 'À égalité'), 12);
});

test('effectivePnl : pips × lots × valeur du pip, signe selon le résultat', () => {
  const est = effectivePnl(mk({ result: 'Gagnant', pips: 40, lots: 0.5, fees: 2 }), settings);
  assert.deepEqual(est, { value: 200, estimated: true });
  assert.deepEqual(effectivePnl(mk({ result: 'Perdant', pips: 30, lots: 1 }), settings), { value: -300, estimated: true });
  const jpy = effectivePnl(mk({ pair: 'USDJPY', result: 'Gagnant', pips: 10, lots: 1 }), settings);
  assert.equal(jpy.value, 65); // USDJPY : 6,5 $ par pip avec le taux de ces réglages de test
  assert.deepEqual(effectivePnl(mk({ result: 'Perdant', pnl: 80 }), settings), { value: -80, estimated: false }); // sans pips : ancien montant
  assert.equal(effectivePnl(mk({ result: 'Gagnant', pips: 40 }), { ...settings, defaultLots: 0 }), null);
});

test('realBalance : dernier solde saisi par l\'utilisateur', () => {
  const a = mk({ date: '2026-02-01', balance: 100 });
  const b = mk({ date: '2026-02-03', balance: 140 });
  const c = mk({ date: '2026-02-05' }); // pas de solde saisi : ignoré
  assert.equal(realBalance([a, c, b]), 140);
  assert.equal(realBalance([c]), null);
});
test('valeur du pip par paire (réglages avancés)', () => {
  assert.equal(pipValueFor('EURUSD', settings), 10);
});

test('rMultiple : nécessite un risque', () => {
  assert.equal(rMultiple(mk({ result: 'Gagnant', pnl: 200, risk: 100 }), settings), 2);
  assert.equal(rMultiple(mk({ result: 'Perdant', pnl: 100, risk: 100 }), settings), -1);
  assert.equal(rMultiple(mk({ result: 'Gagnant', pnl: 200 }), settings), null);
});

test('formatMoney ne plante pas sur une devise inconnue', () => {
  assert.match(formatMoney(1234.5, 'USD'), /1\s?234,50/);
  assert.match(formatMoney(5, 'XXZ?'), /5/);
  assert.equal(formatMoney(null), '—');
});

test('summarize : taux de réussite façon Excel (égalités exclues)', () => {
  const trades = [
    mk({ date: '2026-01-01', result: 'Gagnant', scenario: 'Scénario 1', pips: 40 }),
    mk({ date: '2026-01-02', result: 'Perdant', scenario: 'Scénario 1' }),
    mk({ date: '2026-01-03', result: 'Gagnant', scenario: 'Scénario 2', pips: 20 }),
    mk({ date: '2026-01-04', result: 'À égalité', scenario: 'Scénario 2' }),
    mk({ date: '2026-01-05', result: '' }), // en cours
  ];
  const s = summarize(trades, settings, 0);
  assert.equal(s.total, 5);
  assert.equal(s.completed, 4);
  assert.equal(s.open, 1);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 1);
  assert.equal(s.breakeven, 1);
  assert.equal(s.winRate, 2 / 3);
  assert.equal(s.pips.total, 60);
  assert.deepEqual(s.pips.coverage, { with: 2, of: 4 });
  const sc1 = s.byScenario.find((g) => g.key === 'Scénario 1');
  assert.equal(sc1.winRate, 0.5);
  assert.equal(s.curves.outcome.at(-1).value, 1);
});

test('summarize : argent, profit factor, drawdown et capital initial', () => {
  const trades = [
    mk({ date: '2026-02-01', result: 'Gagnant', pnl: 100 }),
    mk({ date: '2026-02-02', result: 'Perdant', pnl: 50 }),
    mk({ date: '2026-02-03', result: 'Perdant', pnl: 70 }),
    mk({ date: '2026-02-04', result: 'Gagnant', pnl: 200 }),
  ];
  const s = summarize(trades, settings, 1000);
  assert.equal(s.money.total, 180);
  assert.equal(s.money.profitFactor, 300 / 120);
  assert.deepEqual(s.curves.equity.map((p) => p.value), [1100, 1050, 980, 1180]);
  assert.equal(s.money.drawdown.amount, 120);
  assert.ok(Math.abs(s.money.drawdown.pct - 120 / 1100) < 1e-9);
  assert.equal(s.money.expectancy, 45);
});

test('summarize : sans aucun montant, pas de faux zéros', () => {
  const s = summarize([mk({ result: 'Gagnant' })], settings, 0);
  assert.equal(s.money.total, null);
  assert.equal(s.money.profitFactor, null);
  assert.equal(s.money.drawdown, null);
  assert.equal(summarize([], settings).winRate, null);
});

test('profit factor infini quand il n’y a aucune perte', () => {
  const s = summarize([mk({ result: 'Gagnant', pnl: 10 })], settings);
  assert.equal(s.money.profitFactor, Infinity);
});

test('streaks ignorent les égalités et gardent la série courante', () => {
  const seq = ['Gagnant', 'Gagnant', 'À égalité', 'Gagnant', 'Perdant', 'Perdant'].map((r, i) =>
    mk({ date: `2026-03-0${i + 1}`, result: r }),
  );
  const st = streaks(sortTrades(seq));
  assert.equal(st.maxWin, 3);
  assert.equal(st.maxLoss, 2);
  assert.deepEqual(st.current, { type: 'Perdant', count: 2 });
});

test('discipline : taux selon le respect des règles', () => {
  const trades = [
    mk({ result: 'Gagnant', rulesFollowed: true }),
    mk({ result: 'Gagnant', rulesFollowed: true }),
    mk({ result: 'Perdant', rulesFollowed: false }),
    mk({ result: 'Perdant', rulesFollowed: false }),
    mk({ result: 'Gagnant', rulesFollowed: false }),
  ];
  const { discipline } = summarize(trades, settings);
  assert.equal(discipline.followed.winRate, 1);
  assert.equal(discipline.broken.winRate, 1 / 3);
});

test('maxDrawdown sur série vide', () => {
  assert.equal(maxDrawdown([]), null);
});

test('par jour de semaine : lundi en premier', () => {
  const trades = [
    mk({ date: '2026-11-08', result: 'Gagnant' }), // dimanche
    mk({ date: '2026-11-09', result: 'Perdant' }), // lundi
  ];
  const labels = summarize(trades, settings).byWeekday.map((g) => g.label);
  assert.deepEqual(labels, ['Lundi', 'Dimanche']);
});

test('summarize expose le total gagné et le total perdu', () => {
  const t = (result, pnl) => normalizeTrade({ date: '2026-01-05', pair: 'EURUSD', result, pnl });
  const s = summarize([t('Gagnant', 100), t('Gagnant', 50), t('Perdant', 30)], { defaultPipValue: 10, pipValues: {} });
  assert.equal(s.money.grossWin, 150);
  assert.equal(s.money.grossLoss, 30);
  assert.equal(s.money.total, 120);
});

import { pipValueInfo, splitPair, pipSize } from '../src/core/domain/money.js';

test('valeur du pip calculée selon la paire (compte en USD)', () => {
  const s = { currency: 'USD', defaultPipValue: 10, pipValues: {}, conversionRates: {} };
  assert.deepEqual(splitPair('gbp/usd'), { base: 'GBP', quote: 'USD' });
  assert.equal(pipSize('USDJPY'), 0.01); assert.equal(pipSize('EURUSD'), 0.0001);
  assert.equal(pipValueInfo('GBPUSD', s).value, 10);                       // cotée en USD : 10 $ par pip et par lot
  assert.ok(Math.abs(pipValueInfo('USDJPY', s).value - 6.7) < 0.01);       // 1000 ¥ × 0,0067
  assert.ok(Math.abs(pipValueInfo('AUDCAD', s).value - 7.2) < 0.01);       // 10 CAD × 0,72
  assert.equal(pipValueInfo('USDJPY', { ...s, conversionRates: { JPY: 0.0065 } }).value, 6.5);
  assert.deepEqual(pipValueInfo('USDJPY', { ...s, pipValues: { USDJPY: 7 } }), { value: 7, source: 'manuel' });
  assert.equal(pipValueInfo('XAUUSD', s).source, 'défaut');                // l'or n'est pas une paire de devises : repli
  assert.equal(pipValueInfo('US30', s).source, 'défaut');                  // indice : repli
  assert.equal(pipValueInfo('EURUSD', { ...s, currency: 'EUR' }).source, 'défaut'); // compte en EUR sans taux : repli sans inventer
});

test('estimation de l\'argent : pips × lots × valeur du pip de la paire', () => {
  const s = { currency: 'USD', defaultPipValue: 10, pipValues: {}, conversionRates: {} };
  const t = normalizeTrade({ date: '2026-01-05', pair: 'GBPUSD', result: 'Gagnant', pips: 45, lots: 0.2 });
  assert.equal(effectivePnl(t, s).value, 90);                              // 45 × 0,2 × 10
  const jpy = normalizeTrade({ date: '2026-01-05', pair: 'USDJPY', result: 'Perdant', pips: 30, lots: 0.5 });
  assert.ok(Math.abs(effectivePnl(jpy, s).value + 100.5) < 0.01);          // −30 × 0,5 × 6,7
});

test('sans lots saisis : le lot par défaut des réglages sert à estimer l\'argent', () => {
  const settings = mergeSettings({});
  const t = normalizeTrade({ date: '2026-01-05', pair: 'AUDUSD', result: 'Gagnant', pips: 20.5 });
  const p = effectivePnl(t, settings);
  assert.equal(Math.round(p.value * 1000) / 1000, 2.05); // 20,5 pips × 0,01 lot × 10 $ (AUDUSD)
  assert.equal(p.estimated, true);
  assert.equal(effectivePnl(t, { ...settings, defaultLots: 0 }), null); // désactivé
  assert.equal(effectivePnl({ ...t, lots: 0.1 }, settings).value, 20.5 * 0.1 * 10); // des lots saisis priment
});

test('validateTrade : le solde réel est obligatoire pour un trade gagnant ou perdant', () => {
  assert.ok(validateTrade(mk({ result: 'Gagnant' })).errors.balance);
  assert.ok(validateTrade(mk({ result: 'Perdant', balance: null })).errors.balance);
  assert.equal(validateTrade(mk({ result: 'Gagnant', balance: 14.5 })).ok, true);
  assert.equal(validateTrade(mk({ result: '' })).ok, true);          // trade en cours : pas de solde exigé
  assert.equal(validateTrade(mk({ result: 'À égalité' })).ok, true);
});
