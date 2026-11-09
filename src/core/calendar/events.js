/**
 * Calendrier économique : modèle commun, filtres et regroupements.
 * Fonctions pures (aucun accès réseau ni DOM) : testables sous Node.
 * Un événement : { id, at (ISO UTC), country, currency, title, impact: 'low'|'medium'|'high',
 *                  actual, forecast, previous }
 */
export const IMPACTS = ['low', 'medium', 'high'];
export const IMPACT_LABELS = { low: 'Faible', medium: 'Moyen', high: 'Très fort' };
export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

const COUNTRY_CURRENCY = {
  US: 'USD', EU: 'EUR', EMU: 'EUR', EA: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  GB: 'GBP', UK: 'GBP', JP: 'JPY', AU: 'AUD', CA: 'CAD', CH: 'CHF', NZ: 'NZD', CN: 'CNY',
};
export const currencyOfCountry = (c) => COUNTRY_CURRENCY[String(c ?? '').toUpperCase()] ?? '';

export function normalizeImpact(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (['high', 'haut', 'fort', '3', 'red'].includes(s)) return 'high';
  if (['medium', 'moyen', 'med', '2', 'orange'].includes(s)) return 'medium';
  return 'low';
}

/** « 2026-11-09 13:30:00 » (sans fuseau) est lu comme UTC. */
export function toISOUtc(value) {
  if (!value) return null;
  const s = String(value).trim();
  const withTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}${s.length <= 10 ? 'T00:00:00' : ''}Z`;
  const d = new Date(withTz);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const num = (v) => (v === null || v === undefined || v === '' ? null : v);

export function makeEvent({ at, country, currency, title, impact, actual, forecast, previous }) {
  const iso = toISOUtc(at);
  if (!iso || !title) return null;
  const cur = String(currency || currencyOfCountry(country) || '').toUpperCase();
  return {
    id: `${iso}|${country ?? cur}|${title}`,
    at: iso, country: String(country ?? '').toUpperCase(), currency: cur, title: String(title).trim(),
    impact: normalizeImpact(impact), actual: num(actual), forecast: num(forecast), previous: num(previous),
  };
}

/** @param {Set<string>|string[]} impacts  @param {Set<string>|string[]|null} currencies (null = toutes) */
export function filterEvents(events, { impacts = IMPACTS, currencies = null } = {}) {
  const imp = new Set(impacts);
  const cur = currencies && [...currencies].length ? new Set(currencies) : null;
  return events.filter((e) => imp.has(e.impact) && (!cur || cur.has(e.currency)))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.title.localeCompare(b.title)));
}

const pad = (n) => String(n).padStart(2, '0');
export const localDay = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Regroupe par jour LOCAL (le fuseau de l'appareil). @returns {{day:string, events:object[]}[]} */
export function groupByDay(events) {
  const map = new Map();
  for (const e of events) {
    const k = localDay(e.at);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, list]) => ({ day, events: list }));
}

/** Prochains événements à partir de `now`. */
export function upcoming(events, now = new Date(), { impacts = IMPACTS, currencies = null, limit = 5 } = {}) {
  const t = now.toISOString();
  return filterEvents(events, { impacts, currencies }).filter((e) => e.at >= t).slice(0, limit);
}

/** Lundi → dimanche (dates locales ISO) de la semaine contenant `date`, décalée de `offset` semaines. */
export function weekRange(date = new Date(), offset = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset * 7);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const iso = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return { from: iso(monday), to: iso(sunday) };
}

/** Devises présentes dans les paires que l'utilisateur trade (GBPUSD → GBP, USD). */
export function currenciesFromPairs(pairs) {
  const set = new Set();
  for (const p of pairs) {
    const s = String(p ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 6) { set.add(s.slice(0, 3)); set.add(s.slice(3)); }
  }
  return [...set].filter((c) => MAJOR_CURRENCIES.includes(c));
}

/** Temps restant lisible : « dans 2 h 15 », « dans 12 min », « maintenant », « il y a 1 h ». */
export function relativeTime(iso, now = new Date()) {
  const min = Math.round((new Date(iso) - now) / 60000);
  const abs = Math.abs(min);
  const txt = abs < 1 ? 'maintenant' : abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${pad(abs % 60)}` : ''}` : `${Math.round(abs / 1440)} j`;
  if (abs < 1) return txt;
  return min > 0 ? `dans ${txt}` : `il y a ${txt}`;
}
