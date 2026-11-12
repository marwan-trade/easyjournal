/** Réglages par défaut et fusion sûre avec ce qui est stocké (ajout de nouvelles clés sans rien casser). */

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  theme: 'auto', // 'auto' | 'light' | 'dark'
  mode: 'reel', // mode affiché
  backtest: false, // interface Backtesting ouverte (bouton dans le profil) ; fermée = tout est en réel
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
