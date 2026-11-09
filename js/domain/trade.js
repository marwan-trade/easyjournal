/**
 * Modèle d'un trade : constantes, normalisation et validation.
 * Module pur (aucun accès DOM ni stockage) pour rester testable sous Node.
 */

export const MODES = ['reel', 'backtest'];
export const MODE_LABELS = { reel: 'Réel', backtest: 'Backtest' };
export const RESULTS = ['Gagnant', 'Perdant', 'À égalité'];
export const SIDES = ['Achat', 'Vente'];

/** Convertit une saisie libre en nombre. Accepte la virgule décimale. Retourne null si vide/invalide. */
export function parseNum(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Date locale au format YYYY-MM-DD (sans décalage de fuseau). */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyTrade(mode = 'reel') {
  const now = Date.now();
  return {
    id: newId(),
    mode,
    date: todayISO(),
    pair: '',
    scenario: '',
    side: '',
    timeframe: '',
    result: '', // '' = trade en cours
    rulesFollowed: null, // true | false | null (non renseigné)
    rr: null, // RR prévu, ratio 1:x -> x
    pips: null,
    lots: null,
    risk: null, // montant risqué
    pnl: null, // gain/perte net saisi (null = non saisi)
    fees: null,
    notes: '',
    tags: [],
    screenshot: '', // data URL JPEG réduite
    custom: {},
    createdAt: now,
    updatedAt: now,
  };
}

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

/** Nettoie un trade brut (import, formulaire) vers la forme canonique. */
export function normalizeTrade(raw, defaults = {}) {
  const base = emptyTrade(defaults.mode ?? raw.mode ?? 'reel');
  const t = { ...base, ...raw };
  t.id = str(raw.id) || base.id;
  t.mode = MODES.includes(t.mode) ? t.mode : base.mode;
  t.date = str(t.date);
  t.pair = str(t.pair).toUpperCase().replace(/[\s/]/g, '');
  t.scenario = str(t.scenario);
  t.side = SIDES.includes(str(t.side)) ? str(t.side) : '';
  t.timeframe = str(t.timeframe);
  t.result = RESULTS.includes(str(t.result)) ? str(t.result) : '';
  t.rulesFollowed = t.rulesFollowed === true ? true : t.rulesFollowed === false ? false : null;
  for (const k of ['rr', 'pips', 'lots', 'risk', 'pnl', 'fees']) t[k] = parseNum(t[k]);
  t.notes = str(t.notes);
  t.tags = Array.isArray(t.tags)
    ? t.tags.map(str).filter(Boolean)
    : str(t.tags).split(',').map(str).filter(Boolean);
  t.screenshot = typeof t.screenshot === 'string' ? t.screenshot : '';
  t.custom = t.custom && typeof t.custom === 'object' ? { ...t.custom } : {};
  t.createdAt = Number.isFinite(t.createdAt) ? t.createdAt : base.createdAt;
  t.updatedAt = Number.isFinite(t.updatedAt) ? t.updatedAt : base.updatedAt;
  return t;
}

/** @returns {{ok:boolean, errors:Record<string,string>}} */
export function validateTrade(t) {
  const errors = {};
  if (!isValidISODate(t.date)) errors.date = 'Date invalide.';
  if (!t.pair) errors.pair = 'La paire est obligatoire.';
  if (t.lots !== null && t.lots <= 0) errors.lots = 'Les lots doivent être supérieurs à 0.';
  if (t.rr !== null && t.rr <= 0) errors.rr = 'Le RR doit être supérieur à 0.';
  if (t.risk !== null && t.risk < 0) errors.risk = 'Le risque ne peut pas être négatif.';
  if (t.fees !== null && t.fees < 0) errors.fees = 'Les frais ne peuvent pas être négatifs.';
  return { ok: Object.keys(errors).length === 0, errors };
}

export const isCompleted = (t) => RESULTS.includes(t.result);

/**
 * Règle de signe : le résultat (Gagnant/Perdant) décide du signe des pips et de l'argent.
 * On peut donc saisir « 45 » ou « -45 » pour une perte, le calcul reste cohérent.
 * Pour « À égalité » ou « en cours », la valeur saisie est conservée telle quelle.
 */
export function applyResultSign(value, result) {
  if (value === null || value === undefined) return null;
  if (result === 'Gagnant') return Math.abs(value);
  if (result === 'Perdant') return -Math.abs(value);
  return value;
}

export const signedPips = (t) => applyResultSign(t.pips, t.result);

/** Ordre chronologique stable : date, puis horodatage de création. */
export function compareTrades(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.createdAt ?? 0) - (b.createdAt ?? 0);
}

/** Clé de détection des doublons à l'import. */
export function dedupeKey(t) {
  return [t.mode, t.date, t.pair, t.scenario, t.side, t.timeframe, t.result, t.notes.slice(0, 40)].join('|');
}
