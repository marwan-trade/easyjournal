/**
 * Export « Journale de trading version finale » : les trades sont écrits dans le modèle Excel (public/assets/modele-journal.xlsx),
 * feuilles Backtesting et Réel, avec le dépôt, le lot par défaut et les valeurs de pip choisies dans les paramètres.
 * Les formules du modèle (estimation, solde, résumé) se recalculent à l'ouverture dans Excel.
 */
import { openZip } from './xlsx.js';
import { writeZip } from './zip.js';

export const MAX_ROWS = 500; // lignes prévues par feuille dans le modèle (2 à 501)
export const JOURNAL_FILENAME = 'Journale de trading version finale.xlsx';

const SHEETS = { backtest: 'xl/worksheets/sheet2.xml', reel: 'xl/worksheets/sheet3.xml' };
const PIP_ROWS = { EURUSD: 36, GBPUSD: 37, AUDUSD: 38, NZDUSD: 39, USDJPY: 40, USDCHF: 41, USDCAD: 42, EURGBP: 43, EURJPY: 44, EURCHF: 45, EURCAD: 46, EURAUD: 47, GBPJPY: 48, GBPCHF: 49, GBPCAD: 50, GBPAUD: 51, AUDCAD: 52, AUDJPY: 53, CADJPY: 54, CHFJPY: 55, NZDJPY: 56 };

const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (ref, s, v) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
const numb = (ref, s, v) => `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
export const excelSerial = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569; };

/** Remplace une cellule vide du modèle (`<c r="A2" s="15"/>`) ; garde la cellule telle quelle si la valeur est vide. */
function setCell(xml, ref, build, value) {
  if (value === null || value === undefined || value === '') return xml;
  const re = new RegExp(`<c r="${ref}" s="(\\d+)"/>`);
  return re.test(xml) ? xml.replace(re, (_, s) => build(ref, s, value)) : xml;
}

function fillRow(xml, r, t) {
  const m = new RegExp(`<row r="${r}"[^>]*>.*?</row>`, 's').exec(xml);
  if (!m) return xml;
  let row = m[0];
  const pips = t.pips === null || t.pips === undefined ? null : Math.abs(t.pips);
  row = setCell(row, `A${r}`, numb, excelSerial(t.date));
  row = setCell(row, `B${r}`, text, t.pair);
  row = setCell(row, `C${r}`, text, t.scenario);
  row = setCell(row, `D${r}`, text, t.side);
  row = setCell(row, `E${r}`, text, t.timeframe);
  row = setCell(row, `F${r}`, text, t.result);
  row = setCell(row, `G${r}`, text, t.rulesFollowed === true ? 'Oui' : t.rulesFollowed === false ? 'Non' : '');
  row = setCell(row, `I${r}`, text, t.notes);
  row = setCell(row, `J${r}`, numb, t.rr);
  row = setCell(row, `K${r}`, numb, pips);
  row = setCell(row, `L${r}`, numb, t.lots > 0 ? t.lots : null);
  row = setCell(row, `N${r}`, numb, t.balance !== null && t.balance !== undefined ? Math.abs(t.balance) : null);
  return xml.slice(0, m.index) + row + xml.slice(m.index + m[0].length);
}

const byDate = (a, b) => (a.date === b.date ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : a.date < b.date ? -1 : 1);

function setSummaryValue(xml, ref, value) {
  if (!(value > 0)) return xml;
  return xml.replace(new RegExp(`<c r="${ref}" s="(\\d+)"(?:/>|>.*?</c>)`), (_, s) => numb(ref, s, value));
}

/**
 * @param {{trades:object[], settings:object, template:Uint8Array|ArrayBuffer}} args
 * @returns {Promise<Uint8Array>} le fichier .xlsx
 */
export async function buildJournalXlsx({ trades, settings, template }) {
  const zip = openZip(template);
  const names = zip.names();
  const out = [];
  const td = new TextDecoder(); const te = new TextEncoder();
  const bySheet = {};
  for (const [mode, path] of Object.entries(SHEETS)) {
    const list = trades.filter((t) => t.mode === mode).sort(byDate);
    if (list.length > MAX_ROWS) throw new Error(`Le modèle Excel contient ${MAX_ROWS} lignes par feuille : tu as ${list.length} trades en ${mode === 'reel' ? 'Réel' : 'Backtest'}. Utilise la sauvegarde JSON pour tout garder.`);
    bySheet[path] = list;
  }
  for (const name of names) {
    let data = await zip.read(name);
    if (bySheet[name]) {
      let xml = td.decode(data);
      bySheet[name].forEach((t, i) => { xml = fillRow(xml, i + 2, t); });
      data = te.encode(xml);
    } else if (name === 'xl/worksheets/sheet1.xml') {
      let xml = td.decode(data);
      xml = setSummaryValue(xml, 'B31', settings.initialCapital?.backtest);
      xml = setSummaryValue(xml, 'B32', settings.initialCapital?.reel);
      xml = setSummaryValue(xml, 'B34', settings.defaultLots);
      for (const [pair, v] of Object.entries(settings.pipValues ?? {})) if (PIP_ROWS[pair]) xml = setSummaryValue(xml, `B${PIP_ROWS[pair]}`, v);
      data = te.encode(xml);
    }
    out.push({ name, data });
  }
  return writeZip(out);
}
