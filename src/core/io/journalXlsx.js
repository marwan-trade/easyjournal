/**
 * Export « Journale de trading version finale » : les trades sont écrits dans le modèle Excel (public/assets/modele-journal.xlsx),
 * feuilles Backtesting et Réel, avec le dépôt, le lot par défaut et les valeurs de pip choisies dans les paramètres.
 * Les formules du modèle (estimation, solde, résumé) se recalculent à l'ouverture dans Excel.
 */
import { openZip } from './xlsx.js';
import { writeZip } from './zip.js';
import { parseDataUrl } from '../sync/shots.js';

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

function fillRow(xml, r, t, height = 0) {
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
  if (height) row = row.replace(/^<row r="\d+"/, (h) => `${h} ht="${height}" customHeight="1"`);
  return xml.slice(0, m.index) + row + xml.slice(m.index + m[0].length);
}

/* ----- Captures d'écran : placées dans la colonne H (« Référence / repère du graphique »), une image par ligne ----- */
const IMG_W = 2844000; // largeur max (EMU) = colonne H
const IMG_MAX_H = 3600000; // hauteur max (EMU) ≈ 283 pt
const EMU_PT = 12700;

/** Largeur et hauteur d'une image JPEG ou PNG (lues dans l'en-tête), ou null. */
export function imageSize(bytes, mime) {
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (/png/i.test(mime) && v.getUint32(0) === 0x89504e47) return { w: v.getUint32(16), h: v.getUint32(20) };
    if (v.getUint16(0) !== 0xffd8) return null;
    let p = 2;
    while (p + 9 < bytes.length) {
      if (bytes[p] !== 0xff) { p += 1; continue; }
      const marker = bytes[p + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: v.getUint16(p + 5), w: v.getUint16(p + 7) };
      p += 2 + v.getUint16(p + 2);
    }
  } catch { /* image illisible : format par défaut */ }
  return null;
}

/** Dimensions affichées (EMU) : largeur de la colonne, hauteur selon les proportions, plafonnée. */
export function fitImage(size) {
  const ratio = size && size.w > 0 && size.h > 0 ? size.h / size.w : 9 / 16;
  let cx = IMG_W; let cy = Math.round(cx * ratio);
  if (cy > IMG_MAX_H) { cy = IMG_MAX_H; cx = Math.round(cy / ratio); }
  return { cx, cy };
}

const pictureXml = (id, rid, row, cx, cy) => `<xdr:oneCellAnchor><xdr:from><xdr:col>7</xdr:col><xdr:colOff>66675</xdr:colOff><xdr:row>${row - 1}</xdr:row><xdr:rowOff>50800</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Capture ${id - 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;

const drawingXml = (pics) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${pics.map((p, i) => pictureXml(i + 2, `rId${i + 1}`, p.row, p.cx, p.cy)).join('')}</xdr:wsDr>`;
const drawingRels = (pics) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pics.map((p, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${p.file}"/>`).join('')}</Relationships>`;

/** Hauteur de ligne (points) nécessaire pour afficher l'image. */
const rowHeightFor = (cy) => Math.min(409, Math.ceil(cy / EMU_PT) + 10);

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
  const extras = []; // fichiers ajoutés : images, dessins, relations
  const drawingOf = {}; // chemin de feuille -> numéro de dessin
  let imageCount = 0; let drawingCount = 0;
  let usesJpeg = false;
  for (const name of names) {
    let data = await zip.read(name);
    if (bySheet[name]) {
      let xml = td.decode(data);
      const pics = [];
      bySheet[name].forEach((t, i) => {
        const row = i + 2;
        let height = 0;
        if (t.screenshot) {
          try {
            const { mime, bytes } = parseDataUrl(t.screenshot);
            const ext = /png/i.test(mime) ? 'png' : 'jpeg';
            const { cx, cy } = fitImage(imageSize(bytes, mime));
            imageCount += 1; if (ext === 'jpeg') usesJpeg = true;
            const file = `image${imageCount}.${ext}`;
            extras.push({ name: `xl/media/${file}`, data: bytes });
            pics.push({ row, cx, cy, file });
            height = rowHeightFor(cy);
          } catch { /* capture illisible : la ligne est exportée sans image */ }
        }
        xml = fillRow(xml, row, t, height);
      });
      if (pics.length) {
        drawingCount += 1; drawingOf[name] = drawingCount;
        extras.push({ name: `xl/drawings/drawing${drawingCount}.xml`, data: te.encode(drawingXml(pics)) });
        extras.push({ name: `xl/drawings/_rels/drawing${drawingCount}.xml.rels`, data: te.encode(drawingRels(pics)) });
        xml = xml.replace('<tableParts', '<drawing r:id="rId9"/><tableParts');
      }
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
  // relations des feuilles vers leur dessin, et types de contenu des nouvelles parties
  for (const o of out) {
    const sheet = Object.keys(drawingOf).find((p) => o.name === p.replace('worksheets/', 'worksheets/_rels/') + '.rels');
    if (sheet) {
      o.data = te.encode(td.decode(o.data).replace('</Relationships>', `<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingOf[sheet]}.xml"/></Relationships>`));
    }
    if (o.name === '[Content_Types].xml' && drawingCount) {
      let ct = td.decode(o.data);
      if (usesJpeg && !/Extension="jpeg"/.test(ct)) ct = ct.replace('<Default Extension="png"', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png"');
      const over = Array.from({ length: drawingCount }, (_, i) => `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('');
      o.data = te.encode(ct.replace('</Types>', `${over}</Types>`));
    }
  }
  return writeZip([...out, ...extras]);
}
