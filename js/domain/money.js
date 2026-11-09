/**
 * Calculs d'argent. Principe : le résultat saisi par l'utilisateur (venu du courtier)
 * est la source de vérité. À défaut, on propose une ESTIMATION pips × lots × valeur du pip,
 * toujours signalée comme estimée.
 */
import { applyResultSign, signedPips } from './trade.js';

/** Valeur d'un pip pour 1 lot standard, dans la devise du compte. */
export function pipValueFor(pair, settings) {
  const v = settings?.pipValues?.[pair];
  return Number.isFinite(v) && v > 0 ? v : (settings?.defaultPipValue ?? 10);
}

/**
 * Résultat net d'un trade.
 * @returns {{value:number, estimated:boolean} | null}
 */
export function effectivePnl(t, settings) {
  if (t.pnl !== null && t.pnl !== undefined) {
    return { value: applyResultSign(t.pnl, t.result), estimated: false };
  }
  const pips = signedPips(t);
  if (pips !== null && t.lots && t.lots > 0) {
    const gross = pips * t.lots * pipValueFor(t.pair, settings);
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
