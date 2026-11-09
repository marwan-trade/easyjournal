/**
 * État de l'application : source unique de vérité en mémoire, synchronisée avec le stockage.
 * Les écrans s'abonnent avec subscribe() et se redessinent à chaque changement.
 */
import { openDatabase } from './db.js';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, mergeSettings, withSuggestion } from './settings.js';
import { normalizeTrade, newId, dedupeKey } from '../domain/trade.js';

const listeners = new Set();
let db = null;

export const state = {
  ready: false,
  persistent: true,
  trades: [],
  ideas: [],
  settings: structuredClone(DEFAULT_SETTINGS),
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn(state));

export async function init(backend = null) {
  db = backend ?? (await openDatabase());
  state.persistent = db.persistent;
  const [trades, ideas, meta] = await Promise.all([db.all('trades'), db.all('ideas'), db.get('meta', 'settings')]);
  state.trades = trades.map((t) => normalizeTrade(t));
  state.ideas = ideas;
  state.settings = mergeSettings(meta?.value);
  const schema = await db.get('meta', 'schemaVersion');
  if (!schema) await db.put('meta', { key: 'schemaVersion', value: SCHEMA_VERSION });
  // Migrations de DONNÉES futures : if (schema.value < 2) { ...transformer state.trades... }
  state.ready = true;
  emit();
}

export const tradesOf = (mode) => state.trades.filter((t) => t.mode === mode);

/* ----- Réglages ----- */
export async function saveSettings(patch) {
  state.settings = mergeSettings({ ...state.settings, ...patch });
  await db.put('meta', { key: 'settings', value: state.settings });
  emit();
}

/* ----- Trades ----- */
export async function saveTrade(trade) {
  const t = { ...normalizeTrade(trade), updatedAt: Date.now() };
  const i = state.trades.findIndex((x) => x.id === t.id);
  if (i >= 0) state.trades[i] = t;
  else state.trades.push(t);
  await db.put('trades', t);
  // Les nouvelles valeurs (paire, timeframe) deviennent des suggestions pour la prochaine saisie.
  const s = state.settings;
  const pairs = withSuggestion(s.pairs, t.pair);
  const timeframes = withSuggestion(s.timeframes, t.timeframe);
  if (pairs !== s.pairs || timeframes !== s.timeframes) await saveSettings({ pairs, timeframes });
  else emit();
  return t;
}

export async function deleteTrade(id) {
  state.trades = state.trades.filter((t) => t.id !== id);
  await db.delete('trades', id);
  emit();
}

/**
 * Import groupé. @param {'append'|'replace'} strategy
 * 'append' ignore les doublons exacts ; 'replace' remplace les trades du/des mode(s) concerné(s).
 */
export async function importTrades(incoming, strategy = 'append') {
  const modes = new Set(incoming.map((t) => t.mode));
  let toAdd = incoming.map((t) => normalizeTrade({ ...t, id: newId() }));
  if (strategy === 'replace') {
    const removed = state.trades.filter((t) => modes.has(t.mode));
    await Promise.all(removed.map((t) => db.delete('trades', t.id)));
    state.trades = state.trades.filter((t) => !modes.has(t.mode));
  } else {
    const seen = new Set(state.trades.map(dedupeKey));
    toAdd = toAdd.filter((t) => {
      const k = dedupeKey(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  await db.bulkPut('trades', toAdd);
  state.trades.push(...toAdd);
  const s = state.settings;
  let pairs = s.pairs;
  let timeframes = s.timeframes;
  for (const t of toAdd) {
    pairs = withSuggestion(pairs, t.pair);
    timeframes = withSuggestion(timeframes, t.timeframe);
  }
  let scenarios = s.scenarios;
  for (const t of toAdd) scenarios = withSuggestion(scenarios, t.scenario);
  await saveSettings({ pairs, timeframes, scenarios });
  return { added: toAdd.length, ignored: incoming.length - toAdd.length };
}

/** Restauration complète depuis une sauvegarde JSON : remplace tout. */
export async function restoreBackup({ trades, ideas, settings }) {
  await Promise.all([db.clear('trades'), db.clear('ideas')]);
  await db.bulkPut('trades', trades);
  await db.bulkPut('ideas', ideas);
  state.trades = trades;
  state.ideas = ideas;
  await saveSettings(settings ?? {});
}

export async function wipeAll() {
  await Promise.all([db.clear('trades'), db.clear('ideas'), db.clear('meta')]);
  state.trades = [];
  state.ideas = [];
  state.settings = mergeSettings(null);
  emit();
}

/* ----- Idées ----- */
export async function saveIdea(idea) {
  const i = { id: idea.id ?? newId(), title: idea.title.trim(), description: (idea.description ?? '').trim(),
    status: idea.status ?? 'todo', createdAt: idea.createdAt ?? Date.now() };
  const k = state.ideas.findIndex((x) => x.id === i.id);
  if (k >= 0) state.ideas[k] = i; else state.ideas.push(i);
  await db.put('ideas', i);
  emit();
  return i;
}

export async function deleteIdea(id) {
  state.ideas = state.ideas.filter((i) => i.id !== id);
  await db.delete('ideas', id);
  emit();
}
