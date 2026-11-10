/**
 * Lecteur .xlsx minimal et sans dépendance (ZIP + XML), suffisant pour importer un journal.
 * Lit les valeurs des cellules (texte, nombres, booléens). Ignore styles, formules et graphiques.
 * Utilise DecompressionStream (navigateurs récents et Node ≥ 18).
 */

const td = new TextDecoder('utf-8');

function u16(v, o) { return v.getUint16(o, true); }
function u32(v, o) { return v.getUint32(o, true); }

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lit l'annuaire central du ZIP et retourne une fonction d'extraction par nom. */
export function openZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) valide.");

  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) throw new Error('Annuaire ZIP corrompu.');
    const method = u16(view, p + 10);
    const compSize = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    async read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const lo = e.localOffset;
      if (u32(view, lo) !== 0x04034b50) throw new Error('En-tête ZIP corrompu.');
      const start = lo + 30 + u16(view, lo + 26) + u16(view, lo + 28);
      const raw = bytes.subarray(start, start + e.compSize);
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRaw(raw);
      throw new Error(`Compression ZIP non gérée (${e.method}).`);
    },
    async readText(name) {
      const b = await this.read(name);
      return b ? td.decode(b) : null;
    },
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function textOf(xml) {
  const parts = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g;
  let m;
  while ((m = re.exec(xml))) parts.push(m[1] ? decodeXml(m[1]) : '');
  return parts.join('');
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1] ? textOf(m[1]) : '');
  return out;
}

function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  let autoRow = 0;
  while ((rm = rowRe.exec(xml))) {
    const rAttr = /\br="(\d+)"/.exec(rm[1]);
    const rowIdx = rAttr ? Number(rAttr[1]) - 1 : autoRow;
    autoRow = rowIdx + 1;
    const body = rm[2] ?? '';
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    let autoCol = 0;
    while ((cm = cellRe.exec(body))) {
      const attrs = cm[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs);
      const col = ref ? colIndex(ref[1]) : autoCol;
      autoCol = col + 1;
      const type = (/\bt="([^"]*)"/.exec(attrs) || [])[1];
      const inner = cm[2] ?? '';
      let value = null;
      if (type === 'inlineStr') {
        value = textOf(inner);
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        if (v) {
          const raw = decodeXml(v[1]);
          if (type === 's') value = shared[Number(raw)] ?? '';
          else if (type === 'str') value = raw;
          else if (type === 'b') value = raw === '1';
          else if (type === 'e') value = null;
          else value = raw === '' ? null : Number(raw);
        }
      }
      if (value !== null) cells[col] = value;
    }
    if (cells.length) rows[rowIdx] = cells;
  }
  // Remplace les trous (lignes/cellules vides) par des valeurs nulles lisibles.
  return Array.from(rows, (r) => (r ? Array.from(r, (v) => (v === undefined ? null : v)) : []));
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{name:string, rows:any[][]}[]>}
 */
export async function readXlsx(buffer) {
  const zip = openZip(buffer);
  const workbook = await zip.readText('xl/workbook.xml');
  if (!workbook) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx) valide.");
  const rels = (await zip.readText('xl/_rels/workbook.xml.rels')) ?? '';
  const shared = parseSharedStrings(await zip.readText('xl/sharedStrings.xml'));

  const relTarget = new Map();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]*)"/.exec(m[1])?.[1];
    if (id && target) relTarget.set(id, target);
  }

  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? '');
    const rid = /\br:id="([^"]*)"/.exec(m[1])?.[1];
    let target = relTarget.get(rid);
    if (!target) continue;
    target = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const xml = await zip.readText(target);
    if (xml) sheets.push({ name, rows: parseSheet(xml, shared), images: await readSheetImages(zip, target, xml) });
  }
  return sheets;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };

/** Chemin relatif d'un fichier « _rels » : xl/worksheets/sheet2.xml -> xl/worksheets/_rels/sheet2.xml.rels */
const relsPathOf = (path) => path.replace(/([^/]+)$/, '_rels/$1.rels');
function resolvePath(baseFile, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = baseFile.split('/').slice(0, -1);
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}
function relationships(xml) {
  const out = new Map();
  for (const m of (xml ?? '').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]*)"/.exec(m[1])?.[1];
    if (id && target) out.set(id, target);
  }
  return out;
}

/**
 * Images posées sur une feuille. Retourne [{ row, col, mime, bytes }] où `row` est le numéro de ligne Excel
 * (à partir de 1) sur laquelle l'image se termine : une image qui déborde un peu sur l'en-tête reste
 * rattachée à la ligne de données en dessous.
 */
async function readSheetImages(zip, sheetPath, sheetXml) {
  const drawingRid = /<drawing\b[^>]*\br:id="([^"]*)"/.exec(sheetXml)?.[1];
  if (!drawingRid) return [];
  const sheetRels = relationships(await zip.readText(relsPathOf(sheetPath)));
  const drawingTarget = sheetRels.get(drawingRid);
  if (!drawingTarget) return [];
  const drawingPath = resolvePath(sheetPath, drawingTarget);
  const drawing = await zip.readText(drawingPath);
  if (!drawing) return [];
  const drawingRels = relationships(await zip.readText(relsPathOf(drawingPath)));
  const out = [];
  const anchorRe = /<(?:xdr:)?(oneCellAnchor|twoCellAnchor)\b[^>]*>([\s\S]*?)<\/(?:xdr:)?\1>/g;
  for (const a of drawing.matchAll(anchorRe)) {
    const body = a[2];
    const embed = /<(?:a:)?blip\b[^>]*\br:embed="([^"]*)"/.exec(body)?.[1];
    if (!embed) continue;
    const target = drawingRels.get(embed);
    if (!target) continue;
    const mediaPath = resolvePath(drawingPath, target);
    const ext = mediaPath.split('.').pop().toLowerCase();
    if (!MIME[ext]) continue;
    const pos = (tag) => {
      const m = new RegExp(`<(?:xdr:)?${tag}>[\\s\\S]*?<(?:xdr:)?col>(\\d+)<\\/(?:xdr:)?col>[\\s\\S]*?<(?:xdr:)?row>(\\d+)<\\/(?:xdr:)?row>`).exec(body);
      return m ? { col: Number(m[1]), row: Number(m[2]) } : null;
    };
    const end = pos('to') ?? pos('from');
    if (!end) continue;
    const bytes = await zip.read(mediaPath);
    if (bytes) out.push({ row: end.row + 1, col: end.col, mime: MIME[ext], bytes });
  }
  return out;
}
