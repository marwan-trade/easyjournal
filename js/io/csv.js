/** CSV (RFC 4180) : lecture avec détection du séparateur, écriture compatible Excel en français. */

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let best = ';';
  let bestCount = -1;
  for (const d of [';', ',', '\t']) {
    let inQ = false;
    let n = 0;
    for (const ch of firstLine) {
      if (ch === '"') inQ = !inQ;
      else if (ch === d && !inQ) n++;
    }
    if (n > bestCount) { best = d; bestCount = n; }
  }
  return best;
}

export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/**
 * Écrit un CSV avec « ; » et BOM UTF-8 (ouverture directe dans Excel FR).
 * Les cellules commençant par = + - @ sont neutralisées pour éviter l'injection de formules.
 */
export function stringifyCSV(rows, delim = ';') {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
    return /["\n\r;,\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(delim)).join('\r\n') + '\r\n';
}
