/**
 * Contrôleur de synchronisation : état de la connexion, déclenchement automatique, et petit « store » pour React.
 * Si src/config.js est vide, tout reste inactif et l'application fonctionne comme avant (local uniquement).
 */
import { useSyncExternalStore } from 'react';
import { SUPABASE } from './config.js';
import { SupabaseClient, SyncError } from './core/sync/client.js';
import { runSync } from './core/sync/engine.js';
import { state, subscribe, syncAdapter } from './core/store/state.js';

export const syncConfigured = Boolean(SUPABASE.url && SUPABASE.key);
const client = syncConfigured ? new SupabaseClient({ url: SUPABASE.url, key: SUPABASE.key, storage: globalThis.localStorage }) : null;

let snap = { configured: syncConfigured, signedIn: Boolean(client?.signedIn), email: client?.user?.email ?? '', status: 'idle', lastSyncAt: 0, error: '' };
const listeners = new Set();
const set = (patch) => { snap = { ...snap, ...patch }; listeners.forEach((f) => f()); };
export const useSyncStatus = () => useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => snap);

let running = null; let again = false; let lastRev = -1; let timer = null;

export async function syncNow() {
  if (!client?.signedIn) return null;
  if (running) { again = true; return running; }
  set({ status: 'syncing', error: '' });
  running = (async () => {
    try {
      const r = await runSync({ client, adapter: syncAdapter() });
      lastRev = state.rev;
      if (r?.shotsError) set({ status: 'error', lastSyncAt: Date.now(), error: `Données synchronisées, mais pas les captures : ${r.shotsError}` });
      else set({ status: 'idle', lastSyncAt: Date.now(), error: '' });
      return r;
    } catch (e) {
      if (e instanceof SyncError && e.code === 'auth' && !client.signedIn) set({ signedIn: false, email: '' });
      set({ status: e?.code === 'network' ? 'offline' : 'error', error: e?.message ?? 'Synchronisation impossible.' });
      return null;
    } finally {
      running = null;
      if (again) { again = false; schedule(300); }
    }
  })();
  return running;
}

function schedule(ms = 1500) { clearTimeout(timer); timer = setTimeout(syncNow, ms); }

export async function signIn(email, password) {
  await client.signIn(email.trim(), password);
  set({ signedIn: true, email: client.user.email });
  return syncNow();
}
export async function signUp(email, password) {
  const r = await client.signUp(email.trim(), password);
  if (r.needsConfirmation) return { needsConfirmation: true };
  set({ signedIn: true, email: client.user.email });
  await syncNow();
  return { needsConfirmation: false };
}
/** « Mot de passe oublié » : envoie un e-mail avec un lien qui revient sur le site. */
export async function requestPasswordReset(email) {
  await client.recover(email.trim(), `${location.origin}${location.pathname}`);
}
/** Étape finale : nouveau mot de passe (jetons du lien reçu par e-mail), puis connexion automatique. */
export async function completePasswordReset(tokens, password) {
  await client.finishRecovery(tokens, password);
  set({ signedIn: true, email: client.user.email });
  return syncNow();
}
export async function signOut() {
  await client.signOut();
  set({ signedIn: false, email: '', status: 'idle', lastSyncAt: 0, error: '' });
}

/** À appeler une fois l'état chargé : synchronise au démarrage, après chaque modification locale, au retour de connexion et à l'affichage. */
export function startAutoSync() {
  if (!syncConfigured) return;
  subscribe(() => { if (state.rev !== lastRev && client.signedIn) schedule(); });
  addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 5 * 60 * 1000);
  syncNow();
}
