import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readXlsx } from '../src/core/io/xlsx.js';
import { parseCSV, stringifyCSV } from '../src/core/io/csv.js';
import { workbookToTrades, rowsToTrades, tradesToRows, parseDate, parseRR } from '../src/core/io/mapping.js';
import { buildBackup, parseBackup } from '../src/core/io/json.js';
import { normalizeTrade } from '../src/core/domain/trade.js';

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url));

for (const file of ['sample.xlsx', 'sample_lo.xlsx']) {
  test(`xlsx (${file}) : feuilles, accents et entités XML`, async () => {
    const sheets = await readXlsx(await fixture(file));
    assert.deepEqual(sheets.map((s) => s.name), ['Résumé', 'Backtesting', 'Réel']);
    const bt = sheets[1].rows;
    assert.equal(bt[0][4], 'Timeframe de confirmation');
    assert.equal(bt[1][7], 'Test & <accents> é à');
  });

  test(`import (${file}) : feuilles rattachées au bon mode, lignes cassées signalées`, async () => {
    const res = workbookToTrades(await readXlsx(await fixture(file)));
    assert.deepEqual(res.ignoredSheets, ['Résumé']);
    const bt = res.trades.filter((t) => t.mode === 'backtest');
    const re = res.trades.filter((t) => t.mode === 'reel');
    assert.equal(bt.length, 3);
    assert.equal(re.length, 1);
    assert.equal(res.skipped.length, 1);
    assert.equal(res.skipped[0].sheet, 'Réel');

    const t = bt.find((x) => x.date === '2026-01-15');
    assert.equal(t.pair, 'GBPUSD');
    assert.equal(t.result, 'Gagnant');
    assert.equal(t.rulesFollowed, true); // « OUI » en majuscules
    assert.equal(t.rr, 1.5); // « 1:1.5 » -> 1.5
    assert.equal(t.pips, 44.5);
    assert.equal(re[0].rr, 2);
  });
}

test('dates : série Excel, JJ/MM/AAAA, ISO, invalide', () => {
  assert.equal(parseDate(46030), '2026-01-08');
  assert.equal(parseDate('08/01/2026'), '2026-01-08');
  assert.equal(parseDate('8/1/26'), '2026-01-08');
  assert.equal(parseDate('2026-01-08T10:00:00'), '2026-01-08');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('abc'), null);
});

test('RR : formats courants', () => {
  assert.equal(parseRR('1:2'), 2);
  assert.equal(parseRR('1:1,5'), 1.5);
  assert.equal(parseRR(3), 3);
  assert.equal(parseRR(''), null);
  assert.equal(parseRR('0'), null);
});

test('CSV : aller-retour avec séparateur, guillemets, virgule décimale et saut de ligne', () => {
  const trades = [
    normalizeTrade({ mode: 'reel', date: '2026-04-01', pair: 'EURUSD', scenario: 'Scénario 1', result: 'Gagnant',
      pips: 12.5, lots: 0.3, pnl: 37.5, rr: 1.5, rulesFollowed: true, notes: 'ligne 1\nligne "2"; fin', tags: ['a', 'b'] }),
    normalizeTrade({ mode: 'backtest', date: '2026-04-02', pair: 'GBPUSD', result: 'Perdant', pnl: -20, notes: '-attention' }),
  ];
  const csv = stringifyCSV(tradesToRows(trades));
  assert.ok(csv.startsWith('﻿'));
  assert.match(csv, /12,5/);
  const back = rowsToTrades(parseCSV(csv)).trades;
  assert.equal(back.length, 2);
  assert.equal(back[0].mode, 'reel');
  assert.equal(back[0].pips, 12.5);
  assert.equal(back[0].lots, 0.3);
  assert.equal(back[0].rr, 1.5);
  assert.equal(back[0].notes, 'ligne 1\nligne "2"; fin');
  assert.deepEqual(back[0].tags, ['a', 'b']);
  assert.equal(back[1].mode, 'backtest');
  assert.equal(back[1].pnl, -20);
  assert.equal(back[1].notes, '-attention');
});

test('CSV : neutralise les formules à l’export', () => {
  const csv = stringifyCSV([['=HYPERLINK("x")', 'ok']]);
  assert.match(csv, /'=HYPERLINK/);
});

test('CSV : détecte la virgule comme séparateur', () => {
  const rows = parseCSV('Date,Paire,Résultat\n2026-01-01,EURUSD,Gagnant\n');
  assert.deepEqual(rows[1], ['2026-01-01', 'EURUSD', 'Gagnant']);
});

test('import sans colonne mode : demande le mode', () => {
  const r = rowsToTrades([['Date', 'Paire'], ['2026-01-01', 'EURUSD']]);
  assert.equal(r.needsMode, true);
  assert.equal(rowsToTrades([['Date', 'Paire'], ['2026-01-01', 'EURUSD']], { mode: 'backtest' }).trades[0].mode, 'backtest');
});

test('import sans colonne Date : erreur claire', () => {
  const r = rowsToTrades([['Paire'], ['EURUSD']]);
  assert.equal(r.trades.length, 0);
  assert.match(r.skipped[0].reason, /Date/);
});

test('xlsx : fichier invalide rejeté proprement', async () => {
  await assert.rejects(() => readXlsx(new TextEncoder().encode('pas un zip du tout, vraiment pas')), /Excel/);
});

test('sauvegarde JSON : aller-retour et rejet des fichiers étrangers', () => {
  const t = normalizeTrade({ date: '2026-05-05', pair: 'EURUSD', result: 'Gagnant', pnl: 10 });
  const json = JSON.stringify(buildBackup({ trades: [t], ideas: [{ id: '1', title: 'Idée', status: 'todo', createdAt: 1 }], settings: { currency: 'EUR' } }));
  const back = parseBackup(json);
  assert.equal(back.trades.length, 1);
  assert.equal(back.trades[0].pnl, 10);
  assert.equal(back.ideas[0].title, 'Idée');
  assert.equal(back.settings.currency, 'EUR');
  assert.throws(() => parseBackup('{"a":1}'), /EasyJournal/);
  assert.throws(() => parseBackup('pas du json'), /JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'easyjournal-backup', version: 99 })), /plus récente/);
});

test('xlsx : images rattachées à la bonne ligne (même si elles débordent sur l\'en-tête)', async () => {
  const sheets = await readXlsx(await fixture('sample_images.xlsx'));
  const imgs = sheets[0].images;
  assert.deepEqual(imgs.map((i) => i.row), [2, 3]);
  assert.equal(imgs[0].mime, 'image/png');
  const res = workbookToTrades(sheets);
  assert.equal(res.trades.length, 3);
  assert.equal(res.images.length, 3);
  assert.ok(res.images[0] && res.images[1]);
  assert.equal(res.images[2], null);
  assert.equal(res.images[0].bytes[1], 0x50); // « P » de PNG
});

test('RR saisi « 1:2 » ou « 1:1.5 » devenu une heure dans Excel : retrouvé', async () => {
  const res = workbookToTrades(await readXlsx(await fixture('sample_images.xlsx')));
  assert.deepEqual(res.trades.map((t) => t.rr), [1, 1.5, 0.5]); // 0.5 reste un vrai RR
  assert.equal(parseRR(0.043055555555555555), 2);
  assert.equal(parseRR('1:3'), 3);
  assert.equal(parseRR(2), 2);
});

test('readSummarySettings lit le dépôt réel et le lot par défaut du Résumé', async () => {
  const { readSummarySettings } = await import('../src/core/io/mapping.js');
  const sheets = [{ name: 'Résumé', rows: [['Mode', 'Dépôt'], ['Backtest (argent mis sur le compte)', 500], ['Réel (argent mis sur le compte)', '12,58'], ['Lot par défaut', 0.02]] }];
  assert.deepEqual(readSummarySettings(sheets), { deposit: 12.58, defaultLots: 0.02 });
  sheets[0].rows[2][1] = '';
  assert.equal(readSummarySettings(sheets).deposit, null);
});
