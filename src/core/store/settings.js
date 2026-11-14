/** Réglages par défaut et fusion sûre avec ce qui est stocké (ajout de nouvelles clés sans rien casser). */

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  displayName: '', // nom affiché sur le profil
  theme: 'auto', // 'auto' | 'light' | 'dark'
  mode: 'reel', // mode affiché
  backtest: false, // interface Backtesting ouverte (bouton dans les paramètres) ; fermée = tout est en réel
  currency: 'USD',
  initialCapital: { reel: 0, backtest: 0 },
  defaultLots: 0.01, // lot utilisé pour estimer l'argent quand un trade n'a pas de lots (0 = ne pas estimer)
  defaultPipValue: 10, // repli si la paire est inconnue (or, indices…)
  pipValues: {}, // valeur forcée par paire : { USDJPY: 6.5 } (sinon calculée automatiquement)
  conversionRates: {}, // taux perso : valeur de 1 unité de la devise dans la devise du compte { JPY: 0.0065 }
  pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDCAD', 'EURGBP'],
  scenarios: ['Scénario 1', 'Scénario 2', 'Scénario 3', 'Scénario 4'],
  timeframes: ['3min BOS', '5min BOS', '15min BOS', '15min/5min BOS', '45min BOS', 'Pas de confirmation'],
  customFields: [], // [{ key, label, type: 'text'|'number'|'select', options: [] }]
  lastBackupAt: 0, // horodatage de la dernière sauvegarde JSON
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Fusionne des réglages partiels (anciens ou importés) avec les valeurs par défaut. */
export function mergeSettings(stored) {
  const out = structuredClone(DEFAULT_SETTINGS);
  if (!isObj(stored)) return out;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!(key in stored)) continue;
    const def = DEFAULT_SETTINGS[key];
    const val = stored[key];
    if (isObj(def)) {
      if (isObj(val)) out[key] = { ...def, ...val };
    } else if (Array.isArray(def)) {
      if (Array.isArray(val)) out[key] = val;
    } else if (typeof val === typeof def) {
      out[key] = val;
    }
  }
  if (!['reel', 'backtest'].includes(out.mode) || !out.backtest) out.mode = 'reel';
  if (!['auto', 'light', 'dark'].includes(out.theme)) out.theme = 'auto';
  out.currency = String(out.currency || 'USD').toUpperCase().slice(0, 8);
  if (!(out.defaultLots >= 0)) out.defaultLots = DEFAULT_SETTINGS.defaultLots;
  if (!(out.defaultPipValue > 0)) out.defaultPipValue = DEFAULT_SETTINGS.defaultPipValue;
  return out;
}

/** Ajoute à une liste de suggestions une valeur nouvelle (insensible à la casse). */
export function withSuggestion(list, value) {
  const v = String(value ?? '').trim();
  if (!v) return list;
  return list.some((x) => x.toLowerCase() === v.toLowerCase()) ? list : [...list, v];
}

/* ----- Fusion des réglages entre appareils, clé par clé ----- */
// Chaque réglage a son propre horodatage (keyAt) : changer le thème sur un appareil n'écrase plus le dépôt saisi sur l'autre.
const flatKeys = Object.keys(DEFAULT_SETTINGS).flatMap((k) => (k === 'initialCapital' ? ['initialCapital.reel', 'initialCapital.backtest'] : [k]));
const getFlat = (data, k) => {
  const [a, b] = k.split('.');
  const src = data && typeof data === 'object' && a in data ? data[a] : DEFAULT_SETTINGS[a];
  return b ? (isObj(src) && b in src ? src[b] : DEFAULT_SETTINGS[a][b]) : src;
};
const setFlat = (data, k, v) => { const [a, b] = k.split('.'); if (b) data[a] = { ...(isObj(data[a]) ? data[a] : DEFAULT_SETTINGS[a]), [b]: v }; else data[a] = v; };
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const sortedAt = (m) => Object.fromEntries(Object.entries(m ?? {}).filter(([, v]) => v > 0).sort(([a], [b]) => (a < b ? -1 : 1)));

/** Clés dont la valeur diffère entre deux réglages (pour dater les modifications locales). */
export const changedKeys = (before, after) => flatKeys.filter((k) => !same(getFlat(before, k), getFlat(after, k)));

/**
 * Fusionne deux jeux de réglages { data, at, keyAt }. Par clé : la modification la plus récente gagne ;
 * à date égale (anciennes données sans horodatage), la valeur réellement saisie l'emporte sur la valeur par défaut.
 */
export function mergeSettingSets(local, remote) {
  const data = {}; const keyAt = {};
  for (const k of flatKeys) {
    const lv = getFlat(local.data, k); const rv = getFlat(remote.data, k);
    const lt = local.keyAt?.[k] ?? 0; const rt = remote.keyAt?.[k] ?? 0;
    const def = getFlat({}, k);
    let pickRemote;
    if (same(lv, rv)) pickRemote = false;
    else if (lt !== rt) pickRemote = rt > lt;
    else if (same(lv, def)) pickRemote = true;
    else if (same(rv, def)) pickRemote = false;
    else pickRemote = (remote.at ?? 0) > (local.at ?? 0);
    setFlat(data, k, structuredClone(pickRemote ? rv : lv));
    keyAt[k] = Math.max(lt, rt);
  }
  return { data, keyAt: sortedAt(keyAt), at: Math.max(local.at ?? 0, remote.at ?? 0) };
}
/** Deux jeux de réglages disent-ils la même chose (valeurs et dates) ? */
export const sameSettingSets = (a, b) => flatKeys.every((k) => same(getFlat(a.data, k), getFlat(b.data, k))) && same(sortedAt(a.keyAt), sortedAt(b.keyAt));
