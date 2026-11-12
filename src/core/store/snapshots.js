/**
 * Instantanés automatiques : une copie des trades, idées et réglages (sans les captures, trop lourdes) est gardée dans le
 * navigateur de l'utilisateur, au plus une par jour, les 7 dernières. Elle permet de revenir en arrière après une erreur
 * (suppression, mauvais import). Rien ne quitte l'appareil ; « Tout effacer » les supprime aussi.
 */
const KEY = 'snapshots';
export const MAX_SNAPSHOTS = 7;
const DAY = 20 * 3600 * 1000; // un nouvel instantané automatique si le dernier a plus de 20 h

const lite = (trades) => trades.map(({ screenshot, ...t }) => t); // eslint-disable-line no-unused-vars

export async function listSnapshots(db) {
  return (await db.get('meta', KEY))?.value ?? [];
}

/**
 * @param {object} db  stockage
 * @param {{trades:object[], ideas:object[], settings:object}} data
 * @param {{reason?: 'auto'|string, now?: number, force?: boolean}} opts
 * @returns {Promise<boolean>} true si un instantané a été créé
 */
export async function takeSnapshot(db, data, { reason = 'auto', now = Date.now(), force = false } = {}) {
  if (!data.trades.length && !data.ideas.length) return false;
  const list = await listSnapshots(db);
  if (!force && list[0] && now - list[0].at < DAY) return false;
  const snap = { at: now, reason, counts: { trades: data.trades.length, ideas: data.ideas.length }, trades: lite(data.trades), ideas: data.ideas, settings: data.settings };
  await db.put('meta', { key: KEY, value: [snap, ...list].slice(0, MAX_SNAPSHOTS) });
  return true;
}

/** Les captures actuelles sont conservées : l'instantané n'en contient pas. */
export function withCurrentShots(snapTrades, currentTrades) {
  const shots = new Map(currentTrades.filter((t) => t.screenshot).map((t) => [t.id, t.screenshot]));
  return snapTrades.map((t) => (shots.has(t.id) ? { ...t, screenshot: shots.get(t.id) } : t));
}
