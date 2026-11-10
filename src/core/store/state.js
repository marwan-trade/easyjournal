/**
 * État de l'application : source unique de vérité en mémoire, synchronisée avec le stockage.
 * Les écrans s'abonnent avec subscribe() et se redessinent à chaque changement.
 */
import { openDatabase } from './db.js';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, mergeSettings, withSuggestion } from './settings.js';
import { normalizeTrade, newId, dedupeKey } from '../domain/trade.js';
import { isDemoId } from '../sync/engine.js';

const listeners = new Set();
let db = null;

export const state = {
  ready: false,
  persistent: true,
  trades: [],
  ideas: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  settingsAt: 0, // horodatage de la dernière modification des réglages (synchronisation)
  rev: 0, // compteur de modifications LOCALES : déclenche la synchronisation automatique
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
  state.settingsAt = meta?.at ?? 0;
  const schema = await db.get('meta', 'schemaVersion');
  if (!schema) await db.put('meta', { key: 'schemaVersion', value: SCHEMA_VERSION });
  // Migrations de DONNÉES futures : if (schema.value < 2) { ...transformer state.trades... }
  state.ready = true;
  emit();
}

/* ----- Pierres tombales : mémorisent les suppressions pour les propager aux autres appareils ----- */
async function tombstone(kind, ids) {
  const real = ids.filter((id) => !isDemoId(id));
  if (!real.length) return;
  const cur = (await db.get('meta', 'tombstones'))?.value ?? { trades: {}, ideas: {} };
  const ts = Date.now();
  for (const id of real) cur[kind][id] = ts;
  await db.put('meta', { key: 'tombstones', value: cur });
  state.rev += 1;
}

export const tradesOf = (mode) => state.trades.filter((t) => t.mode === mode);

/* ----- Réglages ----- */
export async function saveSettings(patch) {
  state.settings = mergeSettings({ ...state.settings, ...patch });
  state.settingsAt = Date.now();
  state.rev += 1;
  await db.put('meta', { key: 'settings', value: state.settings, at: state.settingsAt });
  emit();
}

/* ----- Trades ----- */
export async function saveTrade(trade) {
  const t = { ...normalizeTrade(trade), updatedAt: Date.now() };
  const i = state.trades.findIndex((x) => x.id === t.id);
  if (i >= 0) state.trades[i] = t;
  else state.trades.push(t);
  await db.put('trades', t);
  state.rev += 1;
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
  await tombstone('trades', [id]);
  emit();
}

/**
 * Import groupé. @param {'append'|'replace'} strategy
 * 'append' ignore les doublons exacts ; 'replace' remplace les trades du/des mode(s) concerné(s).
 */
export async function importTrades(incoming, strategy = 'append') {
  const modes = new Set(incoming.map((t) => t.mode));
  let toAdd = incoming.map((t) => normalizeTrade({ ...t, id: newId() }));
  let attached = 0;
  if (strategy === 'replace') {
    const removed = state.trades.filter((t) => modes.has(t.mode));
    await Promise.all(removed.map((t) => db.delete('trades', t.id)));
    await tombstone('trades', removed.map((t) => t.id));
    state.trades = state.trades.filter((t) => !modes.has(t.mode));
  } else {
    const existing = new Map(state.trades.map((t) => [dedupeKey(t), t]));
    const attach = [];
    toAdd = toAdd.filter((t) => {
      const k = dedupeKey(t);
      const have = existing.get(k);
      if (have) {
        // Doublon : on ne le recrée pas, mais on lui ajoute la capture si elle lui manquait.
        if (t.screenshot && !have.screenshot) { have.screenshot = t.screenshot; have.updatedAt = Date.now(); attach.push(have); }
        return false;
      }
      existing.set(k, t);
      return true;
    });
    if (attach.length) { await db.bulkPut('trades', attach); state.rev += 1; attached = attach.length; }
  }
  await db.bulkPut('trades', toAdd);
  state.trades.push(...toAdd);
  state.rev += 1;
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
  return { added: toAdd.length, ignored: incoming.length - toAdd.length - attached, attached };
}

/** Ajoute des trades tels quels (identifiants conservés) : données de démonstration. */
export async function addTradesRaw(trades) {
  const fresh = trades.filter((t) => !state.trades.some((x) => x.id === t.id));
  await db.bulkPut('trades', fresh);
  state.trades.push(...fresh);
  emit();
  return fresh.length;
}

/** Supprime les trades dont l'identifiant satisfait `pred` (utilisé pour les données de démo). */
export async function deleteTradesWhere(pred) {
  const gone = state.trades.filter(pred);
  await Promise.all(gone.map((t) => db.delete('trades', t.id)));
  await tombstone('trades', gone.map((t) => t.id));
  state.trades = state.trades.filter((t) => !pred(t));
  emit();
  return gone.length;
}

/** Restauration complète depuis une sauvegarde JSON : remplace tout. */
export async function restoreBackup({ trades, ideas, settings }) {
  const keepT = new Set(trades.map((t) => t.id)); const keepI = new Set(ideas.map((i) => i.id));
  const goneT = state.trades.filter((t) => !keepT.has(t.id)).map((t) => t.id);
  const goneI = state.ideas.filter((i) => !keepI.has(i.id)).map((i) => i.id);
  await Promise.all([db.clear('trades'), db.clear('ideas')]);
  await tombstone('trades', goneT); await tombstone('ideas', goneI);
  await db.bulkPut('trades', trades);
  await db.bulkPut('ideas', ideas);
  state.trades = trades;
  state.ideas = ideas;
  state.rev += 1;
  await saveSettings(settings ?? {});
}

export async function wipeAll() {
  const goneT = state.trades.map((t) => t.id); const goneI = state.ideas.map((i) => i.id);
  await Promise.all([db.clear('trades'), db.clear('ideas'), db.clear('meta')]);
  await tombstone('trades', goneT); await tombstone('ideas', goneI); // propagées au cloud si tu es connecté
  state.trades = [];
  state.ideas = [];
  state.settings = mergeSettings(null);
  emit();
}

/* ----- Idées ----- */
export async function saveIdea(idea) {
  const i = { id: idea.id ?? newId(), title: idea.title.trim(), description: (idea.description ?? '').trim(),
    status: idea.status ?? 'todo', createdAt: idea.createdAt ?? Date.now(), updatedAt: Date.now() };
  const k = state.ideas.findIndex((x) => x.id === i.id);
  if (k >= 0) state.ideas[k] = i; else state.ideas.push(i);
  await db.put('ideas', i);
  state.rev += 1;
  emit();
  return i;
}

export async function deleteIdea(id) {
  state.ideas = state.ideas.filter((i) => i.id !== id);
  await db.delete('ideas', id);
  await tombstone('ideas', [id]);
  emit();
}

/* ----- Adaptateur pour le moteur de synchronisation ----- */
export function syncAdapter() {
  return {
    trades: () => state.trades,
    ideas: () => state.ideas,
    settings: () => ({ data: state.settings, at: state.settingsAt }),
    tombstones: async () => (await db.get('meta', 'tombstones'))?.value ?? { trades: {}, ideas: {} },
    getMeta: async (k) => (await db.get('meta', `sync-${k}`))?.value ?? null,
    setMeta: async (k, v) => { await db.put('meta', { key: `sync-${k}`, value: v }); },
    /** Applique ce que la fusion a décidé. N'incrémente PAS rev : ce ne sont pas des modifications locales. */
    async applyRemote({ trades, ideas, settings }) {
      // Les captures ne passent pas par le cloud : on garde celle de cet appareil quand le trade distant n'en a pas.
      const up = trades.upsert.map((t) => {
        const n = normalizeTrade(t);
        if (!n.screenshot) { const mine = state.trades.find((x) => x.id === n.id)?.screenshot; if (mine) n.screenshot = mine; }
        return n;
      });
      if (up.length) {
        await db.bulkPut('trades', up);
        for (const t of up) { const i = state.trades.findIndex((x) => x.id === t.id); if (i >= 0) state.trades[i] = t; else state.trades.push(t); }
      }
      if (trades.remove.length) { await Promise.all(trades.remove.map((id) => db.delete('trades', id))); const g = new Set(trades.remove); state.trades = state.trades.filter((t) => !g.has(t.id)); }
      if (ideas.upsert.length) {
        await db.bulkPut('ideas', ideas.upsert);
        for (const i of ideas.upsert) { const k = state.ideas.findIndex((x) => x.id === i.id); if (k >= 0) state.ideas[k] = i; else state.ideas.push(i); }
      }
      if (ideas.remove.length) { await Promise.all(ideas.remove.map((id) => db.delete('ideas', id))); const g = new Set(ideas.remove); state.ideas = state.ideas.filter((i) => !g.has(i.id)); }
      if (settings) {
        state.settings = mergeSettings(settings.data); state.settingsAt = settings.at;
        await db.put('meta', { key: 'settings', value: state.settings, at: settings.at });
      }
      if (up.length || trades.remove.length || ideas.upsert.length || ideas.remove.length || settings) emit();
    },
  };
}
