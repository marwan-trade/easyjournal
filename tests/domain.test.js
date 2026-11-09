import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrade, validateTrade, parseNum, applyResultSign, isValidISODate } from '../src/core/domain/trade.js';
import { effectivePnl, rMultiple, pipValueFor, formatMoney } from '../src/core/domain/money.js';
import { summarize, maxDrawdown, streaks, sortTrades } from '../src/core/domain/stats.js';

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

test('effectivePnl : saisie réelle prioritaire, sinon estimation signalée', () => {
  const manual = effectivePnl(mk({ result: 'Perdant', pnl: 80, pips: 30, lots: 1 }), settings);
  assert.deepEqual(manual, { value: -80, estimated: false });
  const est = effectivePnl(mk({ result: 'Gagnant', pips: 40, lots: 0.5, fees: 2 }), settings);
  assert.deepEqual(est, { value: 40 * 0.5 * 10 - 2, estimated: true });
  const jpy = effectivePnl(mk({ pair: 'USDJPY', result: 'Gagnant', pips: 10, lots: 1 }), settings);
  assert.equal(jpy.value, 65);
  assert.equal(effectivePnl(mk({ result: 'Gagnant', pips: 40 }), settings), null);
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

import { filterEvents, groupByDay, weekRange, currenciesFromPairs, makeEvent, toISOUtc, upcoming } from '../src/core/calendar/events.js';
import { mapFmpEvent, fetchFmpEvents, CalendarError } from '../src/core/calendar/fmp.js';

const ev = (at, cur, title, impact) => makeEvent({ at, currency: cur, title, impact });

test('calendrier : filtre par impact et par devise, trié par heure', () => {
  const list = [ev('2026-11-09T14:00:00Z', 'USD', 'B', 'High'), ev('2026-11-09T08:00:00Z', 'EUR', 'A', 'Low'), ev('2026-11-09T10:00:00Z', 'USD', 'C', 'Medium')];
  assert.deepEqual(filterEvents(list, { impacts: ['high', 'medium'] }).map((e) => e.title), ['C', 'B']);
  assert.deepEqual(filterEvents(list, { currencies: ['EUR'] }).map((e) => e.title), ['A']);
  assert.equal(filterEvents(list, { impacts: [] }).length, 0);
});

test('calendrier : dates sans fuseau lues en UTC, semaine du lundi au dimanche, devises des paires', () => {
  assert.equal(toISOUtc('2026-11-09 13:30:00'), '2026-11-09T13:30:00.000Z');
  assert.deepEqual(weekRange(new Date(2026, 10, 11)), { from: '2026-11-09', to: '2026-11-15' }); // mercredi 11 nov. 2026
  assert.deepEqual(weekRange(new Date(2026, 10, 15), 1), { from: '2026-11-16', to: '2026-11-22' }); // dimanche + 1 semaine
  assert.deepEqual(currenciesFromPairs(['GBPUSD', 'usdjpy', 'XAUUSD', '']).sort(), ['GBP', 'JPY', 'USD']);
  assert.equal(groupByDay([ev('2026-11-09T10:00:00Z', 'USD', 'x', 'low')]).length, 1);
  assert.equal(upcoming([ev('2026-11-09T10:00:00Z', 'USD', 'x', 'high')], new Date('2026-11-09T11:00:00Z')).length, 0);
});

test('fournisseur FMP : conversion et erreurs lisibles', async () => {
  const e = mapFmpEvent({ date: '2026-11-06 13:30:00', country: 'US', event: 'Non Farm Payrolls', impact: 'High', estimate: 150, previous: 143, actual: null, currency: 'USD' });
  assert.equal(e.impact, 'high'); assert.equal(e.forecast, 150); assert.equal(e.currency, 'USD');
  const fake = (status, body) => async () => ({ status, ok: status < 400, json: async () => body });
  assert.equal((await fetchFmpEvents({ from: 'a', to: 'b', key: 'k', fetchImpl: fake(200, [{ date: '2026-11-06 13:30:00', event: 'X', impact: 'Low', country: 'GB' }]) })).length, 1);
  await assert.rejects(fetchFmpEvents({ from: 'a', to: 'b', key: 'k', fetchImpl: fake(403, {}) }), (err) => err instanceof CalendarError && err.code === 'key');
  await assert.rejects(fetchFmpEvents({ from: 'a', to: 'b', key: 'k', fetchImpl: fake(200, { 'Error Message': 'plan' }) }), (err) => err.code === 'plan');
  await assert.rejects(fetchFmpEvents({ from: 'a', to: 'b', key: '', fetchImpl: fake(200, []) }), (err) => err.code === 'nokey');
  await assert.rejects(fetchFmpEvents({ from: 'a', to: 'b', key: 'k', fetchImpl: async () => { throw new TypeError('fail'); } }), (err) => err.code === 'network');
});
