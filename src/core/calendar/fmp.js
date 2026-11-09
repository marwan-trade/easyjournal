/**
 * Adaptateur Financial Modeling Prep (clé API gratuite).
 * Le reste de l'application ne connaît que le modèle de events.js : changer de fournisseur
 * revient à écrire un autre adaptateur de ce type, sans toucher aux écrans.
 */
import { makeEvent } from './events.js';

export const FMP_URL = 'https://financialmodelingprep.com/stable/economic-calendar';

export class CalendarError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function mapFmpEvent(r) {
  return makeEvent({ at: r.date, country: r.country, currency: r.currency, title: r.event, impact: r.impact,
    actual: r.actual, forecast: r.estimate ?? r.forecast, previous: r.previous });
}

/** @param {{from:string,to:string,key:string,fetchImpl?:typeof fetch,signal?:AbortSignal}} o */
export async function fetchFmpEvents({ from, to, key, fetchImpl = globalThis.fetch, signal }) {
  if (!key) throw new CalendarError('nokey', 'Aucune clé API enregistrée.');
  let res;
  try {
    res = await fetchImpl(`${FMP_URL}?from=${from}&to=${to}&apikey=${encodeURIComponent(key)}`, { signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new CalendarError('network', 'Service injoignable : vérifie ta connexion. Si elle est bonne, le fournisseur bloque peut-être les appels depuis le navigateur.');
  }
  if (res.status === 401 || res.status === 403) throw new CalendarError('key', 'Clé refusée par le fournisseur. Vérifie-la, ou ton offre ne donne pas accès au calendrier.');
  if (res.status === 402) throw new CalendarError('plan', 'Le calendrier économique n\'est pas inclus dans ton offre gratuite chez ce fournisseur.');
  if (res.status === 429) throw new CalendarError('quota', 'Limite quotidienne atteinte. Réessaie plus tard.');
  if (!res.ok) throw new CalendarError('http', `Erreur du service (${res.status}).`);
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) {
    const msg = data?.['Error Message'] ?? data?.message ?? 'Réponse inattendue du fournisseur.';
    throw new CalendarError('plan', String(msg));
  }
  return data.map(mapFmpEvent).filter(Boolean);
}
