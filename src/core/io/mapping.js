/**
 * Passage entre lignes de tableau (CSV / Excel) et trades.
 * La correspondance se fait sur le NOM des colonnes (insensible à la casse et aux accents),
 * donc l'ordre des colonnes n'a pas d'importance.
 */
import { normalizeTrade, parseNum, isValidISODate } from '../domain/trade.js';

const strip = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const ALIASES = {
  mode: ['mode'],
  date: ['date'],
  pair: ['paire', 'pair', 'symbole', 'symbol'],
  scenario: ['scenario'],
  side: ['sens', 'side', 'direction'],
  timeframe: ['timeframedeconfirmation', 'timeframe', 'tf'],
  result: ['resultat', 'result'],
  rulesFollowed: ['reglesrespectees', 'reglesrespecteesoui', 'regles'],
  rr: ['rrprevu', 'rr'],
  pips: ['pipsgagnes', 'pips'],
  lots: ['lots', 'lot'],
  risk: ['risque', 'risk'],
  pnl: ['resultatnet', 'gainperte', 'gainpertenet', 'pnl', 'profit'],
  balance: ['solde', 'soldereel', 'soldereelasaisir', 'balance'],
  fees: ['frais', 'fees', 'commission'],
  tags: ['etiquettes', 'tags'],
  notes: ['notes', 'note', 'commentaire'],
};

export const EXPORT_HEADERS = [
  'Mode', 'Date', 'Paire', 'Scénario', 'Sens', 'Timeframe', 'Résultat', 'Règles respectées',
  'RR prévu', 'Pips', 'Lots', 'Risque', 'Résultat net', 'Solde réel', 'Frais', 'Étiquettes', 'Notes',
];

export function modeFromText(v) {
  const s = strip(v);
  if (s.includes('backtest')) return 'backtest';
  if (s.includes('reel') || s.includes('real') || s.includes('live')) return 'reel';
  return null;
}

/** Excel stocke les dates en nombre de jours depuis le 30/12/1899. */
function excelSerialToISO(serial) {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v > 20000 && v < 80000 ? excelSerialToISO(v) : null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return isValidISODate(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isValidISODate(iso) ? iso : null;
  }
  return null;
}

function parseResult(v) {
  const s = strip(v);
  if (s === 'gagnant' || s === 'win') return 'Gagnant';
  if (s === 'perdant' || s === 'loss') return 'Perdant';
  if (s === 'aegalite' || s === 'egalite' || s === 'breakeven' || s === 'be') return 'À égalité';
  return '';
}

function parseSide(v) {
  const s = strip(v);
  if (['achat', 'buy', 'long'].includes(s)) return 'Achat';
  if (['vente', 'sell', 'short'].includes(s)) return 'Vente';
  return '';
}

function parseRules(v) {
  const s = strip(v);
  if (['oui', 'yes', 'true', '1', 'vrai'].includes(s)) return true;
  if (['non', 'no', 'false', '0', 'faux'].includes(s)) return false;
  return null;
}

/**
 * Excel transforme une saisie « 1:2 » en heure (01:02), stockée comme fraction de jour. On la retrouve :
 *   01:02    -> 1:2   -> RR 2
 *   00:01:01.5 (saisie « 1:1.5 ») -> RR 1.5
 * Retourne null si la valeur ne ressemble pas à ça (par exemple un vrai RR de 0.5).
 */
export function rrFromExcelTime(v) {
  if (!(v > 0 && v < 1)) return null;
  const total = Math.round(v * 86400 * 100) / 100; // secondes
  if (total >= 3600) {
    const h = Math.floor(total / 3600);
    const m = Math.round((total - h * 3600) / 60);
    return h === 1 && m > 0 && m < 60 ? m : null;
  }
  const min = Math.floor(total / 60);
  const sec = Math.round((total - min * 60) * 100) / 100;
  return min === 1 && sec > 0 ? sec : null;
}

/** « 1:1.5 » -> 1.5 ; « 2 » -> 2 ; « 1/3 » -> 3. */
export function parseRR(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v > 0 ? (rrFromExcelTime(v) ?? v) : null;
  const s = String(v).trim();
  const m = /^\s*[\d.,]+\s*[:/]\s*([\d.,]+)\s*$/.exec(s);
  const n = parseNum(m ? m[1] : s);
  return n !== null && n > 0 ? n : null;
}

const unescapeCell = (v) => (typeof v === 'string' ? v.replace(/^'([=+\-@])/, '$1') : v);

/**
 * @param {any[][]} rows première ligne = en-têtes
 * @param {{mode?: 'reel'|'backtest'|null, customFields?: {key:string,label:string}[]}} opts
 * @returns {{trades:object[], skipped:{line:number, reason:string}[], unknownColumns:string[], needsMode:boolean}}
 */
export function rowsToTrades(rows, { mode = null, customFields = [], images = [] } = {}) {
  const trades = [];
  const tradeImages = []; // alignée sur `trades` : { mime, bytes } ou null
  const imageByRow = new Map(); // index de ligne (0 = en-têtes) -> image
  for (const im of images) if (!imageByRow.has(im.row - 1)) imageByRow.set(im.row - 1, im);
  const skipped = [];
  if (!rows.length) return { trades, images: tradeImages, skipped, unknownColumns: [], needsMode: false };

  const headers = rows[0].map((h) => strip(h));
  const idx = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const i = headers.findIndex((h) => names.includes(h));
    if (i >= 0) idx[field] = i;
  }
  const customIdx = [];
  for (const cf of customFields) {
    const i = headers.indexOf(strip(cf.label));
    if (i >= 0) customIdx.push([cf.key, i]);
  }
  const known = new Set([...Object.values(idx), ...customIdx.map(([, i]) => i)]);
  const unknownColumns = rows[0].map((h, i) => [h, i]).filter(([h, i]) => h && !known.has(i)).map(([h]) => String(h));

  if (idx.date === undefined) {
    return { trades, images: tradeImages, skipped: [{ line: 1, reason: 'Colonne « Date » introuvable.' }], unknownColumns, needsMode: false };
  }
  const needsMode = !mode && idx.mode === undefined;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cell = (f) => (idx[f] === undefined ? null : unescapeCell(row[idx[f]] ?? null));
    if (row.every((c) => c === null || c === undefined || c === '')) continue;

    const date = parseDate(cell('date'));
    const pair = cell('pair');
    if (!date) {
      if (pair || cell('result')) skipped.push({ line: r + 1, reason: 'Date absente ou illisible.' });
      continue;
    }
    if (!pair) {
      skipped.push({ line: r + 1, reason: 'Paire absente.' });
      continue;
    }
    let scenario = cell('scenario');
    if (typeof scenario === 'number') scenario = `Scénario ${scenario}`;

    const custom = {};
    for (const [key, i] of customIdx) if (row[i] !== null && row[i] !== undefined && row[i] !== '') custom[key] = row[i];

    const im = imageByRow.get(r);
    tradeImages.push(im ? { mime: im.mime, bytes: im.bytes } : null);
    trades.push(
      normalizeTrade({
        mode: modeFromText(cell('mode')) ?? mode ?? 'reel',
        date,
        pair,
        scenario,
        side: parseSide(cell('side')),
        timeframe: cell('timeframe'),
        result: parseResult(cell('result')),
        rulesFollowed: parseRules(cell('rulesFollowed')),
        rr: parseRR(cell('rr')),
        pips: cell('pips'),
        lots: cell('lots'),
        risk: cell('risk'),
        pnl: cell('pnl'),
        balance: cell('balance'),
        fees: cell('fees'),
        tags: cell('tags') ?? '',
        notes: cell('notes') ?? '',
        custom,
      }),
    );
  }
  return { trades, images: tradeImages, skipped, unknownColumns, needsMode };
}

const num = (v) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return String(v ?? '').trim() === '' ? NaN : n;
};

/** Cherche, dans la feuille « Résumé », le dépôt « Réel » et le lot par défaut (valeur dans la cellule à droite du libellé). */
export function readSummarySettings(sheets) {
  const out = { deposit: null, defaultLots: null };
  const sheet = sheets.find((s) => /^resume/.test(strip(s.name)));
  if (!sheet) return out;
  for (const row of sheet.rows) {
    const label = strip(row[0]);
    if (!label) continue;
    const v = num(row[1]);
    if (!(v > 0)) continue;
    if (/^reel/.test(label) && /argent|compte|depot/.test(label)) out.deposit = v;
    else if (/lotpardefaut/.test(label)) out.defaultLots = v;
  }
  return out;
}

/** Classeur Excel -> trades. Les feuilles sont rattachées au mode par leur nom. */
export function workbookToTrades(sheets, opts = {}) {
  const out = { trades: [], images: [], skipped: [], unknownColumns: [], ignoredSheets: [], needsMode: false, summary: readSummarySettings(sheets) };
  for (const sheet of sheets) {
    const mode = modeFromText(sheet.name);
    if (!mode) { if (!/^resume/.test(strip(sheet.name))) out.ignoredSheets.push(sheet.name); continue; }
    const res = rowsToTrades(sheet.rows, { ...opts, mode, images: sheet.images ?? [] });
    out.trades.push(...res.trades);
    out.images.push(...res.images);
    out.skipped.push(...res.skipped.map((s) => ({ ...s, sheet: sheet.name })));
    for (const c of res.unknownColumns) if (!out.unknownColumns.includes(c)) out.unknownColumns.push(c);
  }
  return out;
}

export function tradesToRows(trades, customFields = []) {
  const header = [...EXPORT_HEADERS, ...customFields.map((c) => c.label)];
  const rows = trades.map((t) => [
    t.mode === 'backtest' ? 'Backtest' : 'Réel',
    t.date, t.pair, t.scenario, t.side, t.timeframe, t.result,
    t.rulesFollowed === true ? 'Oui' : t.rulesFollowed === false ? 'Non' : '',
    t.rr, t.pips, t.lots, t.risk, t.pnl, t.balance, t.fees,
    t.tags.join(', '), t.notes,
    ...customFields.map((c) => t.custom?.[c.key] ?? ''),
  ]);
  return [header, ...rows];
}
