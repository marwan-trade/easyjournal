import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildJournalXlsx, MAX_ROWS } from '../src/core/io/journalXlsx.js';
import { readXlsx, openZip } from '../src/core/io/xlsx.js';
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

test('export : au-delà de la limite, message clair', async () => {
  const many = Array.from({ length: MAX_ROWS + 1 }, (_, i) => mk({ mode: 'reel', date: '2026-01-01', pair: 'EURUSD', result: 'Gagnant', pips: 1, id: `x${i}` }));
  await assert.rejects(() => buildJournalXlsx({ trades: many, settings: mergeSettings({}), template }), /limité à 10000/);
});

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCABaAKADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC1RRRXzR6wUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/2Q==';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

test('export : les captures d\'écran sont placées dans la colonne H, avec leur hauteur de ligne', async () => {
  const { imageSize, fitImage } = await import('../src/core/io/journalXlsx.js');
  const trades = [
    { ...mk({ mode: 'reel', date: '2026-11-04', pair: 'USDJPY', result: 'Gagnant', pips: 10 }), screenshot: JPEG },
    { ...mk({ mode: 'reel', date: '2026-11-05', pair: 'EURUSD', result: 'Perdant', pips: 5 }), screenshot: PNG },
    mk({ mode: 'reel', date: '2026-11-06', pair: 'EURUSD', result: 'Gagnant', pips: 5 }),
    { ...mk({ mode: 'backtest', date: '2026-06-15', pair: 'GBPUSD', result: 'Gagnant', pips: 7 }), screenshot: JPEG },
  ];
  const bytes = await buildJournalXlsx({ trades, settings: mergeSettings({}), template });
  const zip = openZip(bytes);
  const names = zip.names();
  assert.equal(names.filter((n) => n.startsWith('xl/media/')).length, 3);
  assert.equal(names.filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n)).length, 2);
  const sheet3 = await zip.readText('xl/worksheets/sheet3.xml');
  assert.match(sheet3, /<drawing r:id="rId9"\/><tableParts/);
  assert.match(sheet3, /<row r="2"[^>]*customHeight="1"/);
  assert.doesNotMatch(sheet3, /<row r="4"[^>]*customHeight/);
  const rels = await zip.readText('xl/worksheets/_rels/sheet3.xml.rels');
  assert.match(rels, /Id="rId9"[^>]*drawing/);
  const ct = await zip.readText('[Content_Types].xml');
  assert.match(ct, /drawing1\.xml/); assert.match(ct, /Extension="jpeg"/);
  assert.deepEqual(imageSize(new Uint8Array(Buffer.from(JPEG.split(',')[1], 'base64')), 'image/jpeg'), { w: 160, h: 90 });
  const { cx, cy } = fitImage({ w: 160, h: 90 });
  assert.ok(cx <= 2844000 && Math.abs(cy / cx - 90 / 160) < 0.01);
  assert.ok(fitImage({ w: 400, h: 4000 }).cy <= 3600000);
  // le fichier se réimporte toujours (les captures sont lues par l'import)
  const res = workbookToTrades(await readXlsx(bytes));
  assert.equal(res.trades.length, 4);
});

test('export : plus de 500 trades — le modèle est agrandi (lignes, tableau, listes, formules du résumé)', async () => {
  const n = 1200;
  const trades = Array.from({ length: n }, (_, i) => mk({ mode: i % 3 ? 'reel' : 'backtest', date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, pair: 'EURUSD', scenario: 'Scénario 1', result: i % 2 ? 'Gagnant' : 'Perdant', pips: 10 + (i % 7), balance: 1 + (i % 5), id: `t${i}` }));
  const t0 = Date.now();
  const bytes = await buildJournalXlsx({ trades, settings: mergeSettings({ initialCapital: { reel: 100 } }), template });
  assert.ok(Date.now() - t0 < 5000, 'export lent');
  const zip = openZip(bytes);
  const reelCount = trades.filter((t) => t.mode === 'reel').length; // 800 > 500 => capacité 1000
  const s3 = await zip.readText('xl/worksheets/sheet3.xml');
  assert.match(s3, /<dimension ref="A1:N1001"\/>/);
  assert.match(s3, /<row r="1001"/);
  assert.doesNotMatch(s3, /<row r="1002"/);
  assert.match(s3, /sqref="K2:K1001"/);
  assert.match(await zip.readText('xl/tables/table2.xml'), /ref="A1:N1001"/);
  const s1 = await zip.readText('xl/worksheets/sheet1.xml');
  assert.match(s1, /Réel!\$F\$2:\$F\$1001/);
  assert.doesNotMatch(s1, /\$501\b/);
  const res = workbookToTrades(await readXlsx(bytes));
  assert.equal(res.trades.length, n);
  assert.equal(res.trades.filter((t) => t.mode === 'reel').length, reelCount);
  // la dernière ligne a bien sa formule d'estimation
  assert.match(s3, /<c r="M1001"[^>]*><f>IF\(OR\(F1001=""/);
});
