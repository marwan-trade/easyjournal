import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildJournalXlsx, MAX_ROWS } from '../src/core/io/journalXlsx.js';
import { readXlsx } from '../src/core/io/xlsx.js';
import { workbookToTrades } from '../src/core/io/mapping.js';
import { normalizeTrade } from '../src/core/domain/trade.js';
import { mergeSettings } from '../src/core/store/settings.js';

const template = await readFile(new URL('../public/assets/modele-journal.xlsx', import.meta.url));
const mk = (o) => ({ ...normalizeTrade(o), createdAt: 1 });

test('export « version finale » : les trades reviennent identiques à la réimportation', async () => {
  const trades = [
    mk({ mode: 'reel', date: '2026-11-04', pair: 'USDJPY', scenario: 'Scénario 1', side: 'Vente', timeframe: '5min BOS', result: 'Gagnant', rulesFollowed: true, rr: 2, pips: 46.7, lots: 0.02, balance: 6.25, notes: 'Excellent & propre <ok>' }),
    mk({ mode: 'reel', date: '2026-10-22', pair: 'USDCHF', scenario: 'Scénario 2', side: 'Achat', timeframe: '3min', result: 'Perdant', rulesFollowed: false, pips: 20, balance: 2 }),
    mk({ mode: 'backtest', date: '2026-06-15', pair: 'GBPUSD', scenario: 'Scénario 1', side: 'Vente', timeframe: '5min BOS', result: 'Gagnant', rulesFollowed: true, rr: 1.95, pips: 77.9, balance: 7.79 }),
  ];
  const settings = mergeSettings({ initialCapital: { reel: 150, backtest: 50 }, defaultLots: 0.01, pipValues: { USDJPY: 6.5 } });
  const bytes = await buildJournalXlsx({ trades, settings, template });
  const sheets = await readXlsx(bytes);
  const res = workbookToTrades(sheets);
  assert.equal(res.skipped.length, 0);
  assert.equal(res.summary.deposit, 150);
  assert.equal(res.summary.backtestDeposit, 50);
  const key = (t) => `${t.mode}|${t.date}|${t.pair}`;
  const got = Object.fromEntries(res.trades.map((t) => [key(t), t]));
  assert.equal(res.trades.length, 3);
  const a = got['reel|2026-11-04|USDJPY'];
  assert.deepEqual([a.scenario, a.side, a.timeframe, a.result, a.rulesFollowed, a.rr, a.pips, a.lots, a.balance, a.notes], ['Scénario 1', 'Vente', '5min BOS', 'Gagnant', true, 2, 46.7, 0.02, 6.25, 'Excellent & propre <ok>']);
  const b = got['reel|2026-10-22|USDCHF'];
  assert.deepEqual([b.result, b.rulesFollowed, b.pips, b.balance], ['Perdant', false, 20, 2]);
  assert.equal(got['backtest|2026-06-15|GBPUSD'].rr, 1.95);
});

test('export : au-delà de 500 trades dans un mode, message clair', async () => {
  const many = Array.from({ length: MAX_ROWS + 1 }, (_, i) => mk({ mode: 'reel', date: '2026-01-01', pair: 'EURUSD', result: 'Gagnant', pips: 1, id: `x${i}` }));
  await assert.rejects(() => buildJournalXlsx({ trades: many, settings: mergeSettings({}), template }), /500 lignes/);
});
