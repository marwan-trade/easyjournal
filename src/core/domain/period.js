/** Périodes d'analyse : jour, semaine (lundi → dimanche), mois, année, tout. Dates au format ISO « AAAA-MM-JJ ». */

export const PERIODS = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année'], ['all', 'Tout']];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export const todayISO = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Bornes (incluses) de la période qui contient `anchor`. */
export function periodRange(kind, anchor) {
  if (kind === 'all') return { from: null, to: null };
  const d = fromISO(anchor);
  if (kind === 'day') return { from: anchor, to: anchor };
  if (kind === 'week') {
    const monday = addDays(d, -((d.getUTCDay() + 6) % 7));
    return { from: toISO(monday), to: toISO(addDays(monday, 6)) };
  }
  if (kind === 'month') {
    const y = d.getUTCFullYear(); const m = d.getUTCMonth();
    return { from: toISO(new Date(Date.UTC(y, m, 1))), to: toISO(new Date(Date.UTC(y, m + 1, 0))) };
  }
  const y = d.getUTCFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Passe à la période précédente (dir = -1) ou suivante (dir = 1). */
export function shiftAnchor(kind, anchor, dir) {
  if (kind === 'all') return anchor;
  const d = fromISO(anchor);
  if (kind === 'day') return toISO(addDays(d, dir));
  if (kind === 'week') return toISO(addDays(d, 7 * dir));
  if (kind === 'month') {
    const y = d.getUTCFullYear(); const m = d.getUTCMonth() + dir;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return toISO(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))));
  }
  const last = new Date(Date.UTC(d.getUTCFullYear() + dir, d.getUTCMonth() + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(d.getUTCFullYear() + dir, d.getUTCMonth(), Math.min(d.getUTCDate(), last))));
}

export const inPeriod = (date, range) => (!range.from || date >= range.from) && (!range.to || date <= range.to);

const fmt = (iso, opts) => fromISO(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...opts });

export function periodLabel(kind, anchor) {
  if (kind === 'all') return 'Toute la période';
  const { from, to } = periodRange(kind, anchor);
  if (kind === 'day') return fmt(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (kind === 'week') {
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return `${fmt(from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} au ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (kind === 'month') return fmt(from, { month: 'long', year: 'numeric' });
  return fmt(from, { year: 'numeric' });
}
