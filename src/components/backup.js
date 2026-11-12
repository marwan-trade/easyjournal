import { buildBackup } from '../core/io/json.js';
import { saveSettings } from '../store.js';
import { toast } from './toast.jsx';

const WEEK = 7 * 86400000;
export const daysSince = (t, now = Date.now()) => (t ? Math.floor((now - t) / 86400000) : null);
/** Une sauvegarde est due si l'utilisateur a des trades et que la dernière date de plus d'une semaine (ou n'existe pas). */
export const backupDue = (settings, tradesCount, now = Date.now()) => tradesCount > 0 && (!settings.lastBackupAt || now - settings.lastBackupAt > WEEK);

export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: content instanceof Uint8Array ? type : `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Sauvegarde complète (JSON) : trades, captures, idées, réglages. Mémorise la date pour le rappel. */
export async function downloadBackup(state) {
  const day = new Date().toISOString().slice(0, 10);
  download(`easyjournal-sauvegarde-${day}.json`, JSON.stringify(buildBackup({ trades: state.trades, ideas: state.ideas, settings: state.settings }), null, 2), 'application/json');
  await saveSettings({ lastBackupAt: Date.now() });
  toast('Sauvegarde téléchargée.');
}
