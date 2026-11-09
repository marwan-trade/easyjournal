import { formatMoney, formatNumber, formatPercent } from './core/domain/money.js';
export { formatNumber, formatPercent };
export const money = (v, s, opts) => formatMoney(v, s.currency, 'fr-FR', opts);
export const signClass = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : '');
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
}
