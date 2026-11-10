/**
 * Calculs d'argent. Principe : le résultat saisi par l'utilisateur (venu du courtier)
 * est la source de vérité. À défaut, on propose une ESTIMATION pips × lots × valeur du pip,
 * toujours signalée comme estimée.
 */
import { applyResultSign, signedPips } from './trade.js';

/** Taille de lot standard : 1 lot = 100 000 unités de la devise de base. */
export const LOT_UNITS = 100000;

/**
 * Taux indicatifs : combien vaut 1 unité de chaque devise, en DOLLARS américains.
 * Approximatifs (ils bougent chaque jour) : à ajuster dans les réglages si tu veux plus de précision.
 */
export const DEFAULT_RATES_USD = { USD: 1, EUR: 1.08, GBP: 1.3, JPY: 0.0067, CAD: 0.72, CHF: 1.12, AUD: 0.65, NZD: 0.6 };

/** « GBPUSD » → { base: 'GBP', quote: 'USD' } ; null si ce n'est pas une paire de devises (or, indices…). */
export function splitPair(pair) {
  const s = String(pair ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  return s.length === 6 ? { base: s.slice(0, 3), quote: s.slice(3) } : null;
}
/** Un pip vaut 0,01 sur les paires en yen, 0,0001 sinon. */
export const pipSize = (pair) => (splitPair(pair)?.quote === 'JPY' ? 0.01 : 0.0001);

/** Valeur de 1 unité de `cur` dans la devise du compte, ou null si inconnue. */
export function rateToAccount(cur, settings) {
  const account = String(settings?.currency ?? 'USD').toUpperCase();
  if (cur === account) return 1;
  const custom = settings?.conversionRates?.[cur];
  if (Number.isFinite(custom) && custom > 0) return custom;
  if (account === 'USD' && DEFAULT_RATES_USD[cur]) return DEFAULT_RATES_USD[cur];
  return null;
}

/**
 * Valeur d'un pip pour 1 lot, dans la devise du compte, avec sa provenance :
 *  1. valeur forcée par l'utilisateur pour cette paire (settings.pipValues) ;
 *  2. calcul : taille du pip × 100 000 × taux de la devise de cotation ;
 *  3. à défaut, la valeur par défaut des réglages.
 * @returns {{value:number, source:'manuel'|'calculé'|'défaut'}}
 */
export function pipValueInfo(pair, settings) {
  const forced = settings?.pipValues?.[pair];
  if (Number.isFinite(forced) && forced > 0) return { value: forced, source: 'manuel' };
  const p = splitPair(pair);
  // Seules les paires de devises sont calculées : l'or, les indices et les cryptos ont d'autres règles.
  const fx = p && p.base in DEFAULT_RATES_USD && p.quote in DEFAULT_RATES_USD;
  const rate = fx ? rateToAccount(p.quote, settings) : null;
  if (fx && rate) return { value: pipSize(pair) * LOT_UNITS * rate, source: 'calculé' };
  return { value: settings?.defaultPipValue ?? 10, source: 'défaut' };
}

export const pipValueFor = (pair, settings) => pipValueInfo(pair, settings).value;

/**
 * Résultat net d'un trade.
 * @returns {{value:number, estimated:boolean} | null}
 */
export function effectivePnl(t, settings) {
  if (t.pnl !== null && t.pnl !== undefined) {
    return { value: applyResultSign(t.pnl, t.result), estimated: false };
  }
  const pips = signedPips(t);
  // Sans lots saisis, on prend le lot par défaut des réglages (comme la case « Lot par défaut » du cahier Excel).
  const lots = t.lots > 0 ? t.lots : settings.defaultLots > 0 ? settings.defaultLots : null;
  if (pips !== null && lots) {
    const gross = pips * lots * pipValueFor(t.pair, settings);
    return { value: gross - (t.fees ?? 0), estimated: true };
  }
  return null;
}

/** Multiple de R : résultat net / risque pris. Null si risque inconnu ou nul. */
export function rMultiple(t, settings) {
  const p = effectivePnl(t, settings);
  if (!p || !t.risk || t.risk <= 0) return null;
  return p.value / t.risk;
}

export function formatMoney(value, currency = 'USD', locale = 'fr-FR', { sign = false, digits = null } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (Object.is(value, -0) || Math.abs(value) < 1e-9) value = 0; // évite « -0,00 »
  const frac = digits === null ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      signDisplay: sign ? 'exceptZero' : 'auto',
      ...frac,
    }).format(value);
  } catch {
    const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: digits ?? 2, signDisplay: sign ? 'exceptZero' : 'auto' });
    return `${fmt.format(value)} ${currency}`;
  }
}

export function formatNumber(value, { digits = 1, sign = false, locale = 'fr-FR' } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(value);
}

export function formatPercent(ratio, digits = 0, locale = 'fr-FR') {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(ratio);
}
