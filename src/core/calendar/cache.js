/** Petit cache navigateur (30 min) pour économiser le quota gratuit de l'API. Jamais bloquant. */
const TTL = 30 * 60 * 1000;
const K = (from, to) => `easyjournal.cal.${from}.${to}`;

export function readCache(from, to, now = Date.now()) {
  try {
    const raw = JSON.parse(localStorage.getItem(K(from, to)) ?? 'null');
    return raw && now - raw.t < TTL ? raw.events : null;
  } catch { return null; }
}
export function writeCache(from, to, events, now = Date.now()) {
  try { localStorage.setItem(K(from, to), JSON.stringify({ t: now, events })); } catch { /* stockage plein ou refusé */ }
}
export function clearCache() {
  try { Object.keys(localStorage).filter((k) => k.startsWith('easyjournal.cal.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}

/** La clé API reste dans CE navigateur : elle n'est jamais dans les réglages ni dans les sauvegardes JSON. */
const KEY = 'easyjournal.calendarKey';
export const getApiKey = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export const setApiKey = (v) => { try { v ? localStorage.setItem(KEY, v.trim()) : localStorage.removeItem(KEY); } catch { /* ignore */ } };
const DEMO = 'easyjournal.calendarDemo';
export const isDemoCalendar = () => { try { return localStorage.getItem(DEMO) === '1'; } catch { return false; } };
export const setDemoCalendar = (on) => { try { on ? localStorage.setItem(DEMO, '1') : localStorage.removeItem(DEMO); } catch { /* ignore */ } };
