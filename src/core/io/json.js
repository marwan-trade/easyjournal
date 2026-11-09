/** Sauvegarde complète (JSON) : trades, idées et réglages. */
import { normalizeTrade } from '../domain/trade.js';

export const BACKUP_FORMAT = 'easyjournal-backup';
export const BACKUP_VERSION = 1;

export function buildBackup({ trades, ideas, settings }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    trades,
    ideas,
  };
}

/** Valide et nettoie une sauvegarde. Lève une erreur lisible si le fichier n'est pas reconnu. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (!data || data.format !== BACKUP_FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde EasyJournal.");
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('Cette sauvegarde vient d’une version plus récente d’EasyJournal.');
  }
  const trades = Array.isArray(data.trades) ? data.trades.map((t) => normalizeTrade(t)) : [];
  const ideas = Array.isArray(data.ideas)
    ? data.ideas
        .filter((i) => i && typeof i.title === 'string' && i.title.trim())
        .map((i) => ({
          id: String(i.id ?? crypto.randomUUID()),
          title: i.title.trim(),
          description: String(i.description ?? ''),
          status: ['todo', 'doing', 'done'].includes(i.status) ? i.status : 'todo',
          createdAt: Number.isFinite(i.createdAt) ? i.createdAt : Date.now(),
        }))
    : [];
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : null;
  return { trades, ideas, settings };
}
