import test from 'node:test';
import assert from 'node:assert/strict';
import { planMerge, runSync } from '../src/core/sync/engine.js';
import { SupabaseClient, SyncError } from '../src/core/sync/client.js';

/* --- faux serveur : même interface que SupabaseClient, en mémoire --- */
function fakeServer() {
  const tables = { trades: new Map(), ideas: new Map() }; let settings = null;
  return {
    tables,
    pull: async (t, since) => [...tables[t].values()].filter((r) => r.updated_at >= since),
    pullSettings: async () => settings,
    upsert: async (t, rows, onConflict) => { for (const r of rows) { if (t === 'user_settings') settings = { data: r.data, updated_at: r.updated_at }; else tables[t].set(r.id, { ...r }); } },
  };
}
/* --- faux appareil : même interface que syncAdapter() --- */
function fakeDevice() {
  const d = { trades: [], ideas: [], set: { data: {}, at: 0 }, tomb: { trades: {}, ideas: {} }, meta: {} };
  d.adapter = {
    trades: () => d.trades, ideas: () => d.ideas, settings: () => d.set, tombstones: async () => d.tomb,
    getMeta: async (k) => d.meta[k] ?? null, setMeta: async (k, v) => { d.meta[k] = v; },
    async applyRemote({ trades, ideas, settings }) {
      for (const t of trades.upsert) { const i = d.trades.findIndex((x) => x.id === t.id); i >= 0 ? (d.trades[i] = t) : d.trades.push(t); }
      d.trades = d.trades.filter((t) => !trades.remove.includes(t.id));
      for (const t of ideas.upsert) { const i = d.ideas.findIndex((x) => x.id === t.id); i >= 0 ? (d.ideas[i] = t) : d.ideas.push(t); }
      d.ideas = d.ideas.filter((t) => !ideas.remove.includes(t.id));
      if (settings) d.set = settings;
    },
  };
  d.edit = (id, patch, at) => { const i = d.trades.findIndex((t) => t.id === id); const t = { ...(i >= 0 ? d.trades[i] : { id }), ...patch, updatedAt: at }; i >= 0 ? (d.trades[i] = t) : d.trades.push(t); };
  d.remove = (id, at) => { d.trades = d.trades.filter((t) => t.id !== id); d.tomb.trades[id] = at; };
  return d;
}
let clock = 1000;
const sync = (server, dev) => runSync({ client: server, adapter: dev.adapter, now: () => (clock += 100) });

test('synchro : un appareil envoie, un autre reçoit', async () => {
  const srv = fakeServer(), a = fakeDevice(), b = fakeDevice();
  a.edit('t1', { pair: 'EURUSD' }, 1100); a.edit('t2', { pair: 'GBPUSD' }, 1150);
  const r = await sync(srv, a); assert.equal(r.pushed, 2);
  await sync(srv, b);
  assert.deepEqual(b.trades.map((t) => t.id).sort(), ['t1', 't2']);
});

test('synchro : la modification la plus récente gagne, dans les deux sens', async () => {
  const srv = fakeServer(), a = fakeDevice(), b = fakeDevice();
  a.edit('t1', { pair: 'EURUSD', notes: 'v1' }, 1100); await sync(srv, a); await sync(srv, b);
  b.edit('t1', { notes: 'v2 depuis B' }, clock + 10); await sync(srv, b);
  await sync(srv, a);
  assert.equal(a.trades[0].notes, 'v2 depuis B');
  a.edit('t1', { notes: 'v3 depuis A' }, clock + 500); await sync(srv, a); await sync(srv, b);
  assert.equal(b.trades[0].notes, 'v3 depuis A');
});

test('synchro : une modification locale plus récente que le cloud n\'est pas écrasée', async () => {
  const srv = fakeServer(), a = fakeDevice(), b = fakeDevice();
  a.edit('t1', { notes: 'cloud' }, 1100); await sync(srv, a);
  b.edit('t1', { notes: 'hors ligne, plus récent' }, 9_000_000); // éditée hors ligne, horloge plus récente
  await sync(srv, b);
  assert.equal(b.trades[0].notes, 'hors ligne, plus récent');
  assert.equal(srv.tables.trades.get('t1').data.notes, 'hors ligne, plus récent');
});

test('synchro : une suppression se propage, et rien ne ressuscite', async () => {
  const srv = fakeServer(), a = fakeDevice(), b = fakeDevice();
  a.edit('t1', { pair: 'EURUSD' }, 1100); a.edit('t2', { pair: 'USDJPY' }, 1100); await sync(srv, a); await sync(srv, b);
  a.remove('t1', clock + 50); await sync(srv, a);
  assert.equal(srv.tables.trades.get('t1').deleted, true);
  await sync(srv, b);
  assert.deepEqual(b.trades.map((t) => t.id), ['t2']);
  await sync(srv, a); assert.deepEqual(a.trades.map((t) => t.id), ['t2']); // pas de résurrection
});

test('synchro : les données de démonstration ne partent jamais dans le cloud', async () => {
  const srv = fakeServer(), a = fakeDevice();
  a.edit('demo-reel-1', { pair: 'EURUSD' }, 1100); a.edit('vrai', { pair: 'GBPUSD' }, 1100); a.tomb.trades['demo-x'] = 1200;
  await sync(srv, a);
  assert.deepEqual([...srv.tables.trades.keys()], ['vrai']);
});

test('planMerge : réglages les plus récents appliqués, idées fusionnées', () => {
  const plan = planMerge({ local: { trades: [], ideas: [{ id: 'i1', createdAt: 5 }], settings: { data: {}, at: 10 } }, tombstones: { trades: {}, ideas: {} },
    remote: { trades: [], ideas: [{ id: 'i1', data: { title: 'x' }, updated_at: 20, deleted: false }], settings: { data: { mode: 'backtest' }, updated_at: 50 } } });
  assert.equal(plan.apply.ideas.upsert.length, 1);
  assert.equal(plan.apply.settings.data.mode, 'backtest');
});

/* --- client : authentification et accès aux données --- */
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const resp = (status, body) => ({ status, ok: status < 400, json: async () => body });

test('client : connexion, en-têtes, rafraîchissement du jeton sur 401', async () => {
  const calls = []; let n401 = 0;
  const fetchImpl = async (url, o) => {
    calls.push({ url, o });
    if (url.includes('grant_type=password')) return resp(200, { access_token: 'A1', refresh_token: 'R1', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
    if (url.includes('grant_type=refresh_token')) return resp(200, { access_token: 'A2', refresh_token: 'R2', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
    if (url.includes('/rest/v1/trades') && o.headers.Authorization === 'Bearer A1' && n401++ === 0) return resp(401, { message: 'JWT expired' });
    return resp(200, [{ id: 't1' }]);
  };
  const c = new SupabaseClient({ url: 'https://x.supabase.co/', key: 'PUB', storage: memStore(), fetchImpl });
  await c.signIn('a@b.c', 'secret1');
  assert.equal(c.signedIn, true);
  const rows = await c.rest('trades?select=id');
  assert.deepEqual(rows, [{ id: 't1' }]);
  const rest = calls.filter((x) => x.url.includes('/rest/v1/'));
  assert.equal(rest[0].o.headers.apikey, 'PUB'); assert.equal(rest[0].o.headers.Authorization, 'Bearer A1');
  assert.equal(rest[1].o.headers.Authorization, 'Bearer A2'); // rejoué avec le nouveau jeton
});

test('client : messages d\'erreur lisibles en français', async () => {
  const bad = (status, body) => new SupabaseClient({ url: 'https://x.co', key: 'k', storage: memStore(), fetchImpl: async () => resp(status, body) });
  await assert.rejects(bad(400, { error_description: 'Invalid login credentials' }).signIn('a', 'b'), /incorrect/);
  await assert.rejects(bad(422, { msg: 'User already registered' }).signUp('a', 'b'), /existe déjà/);
  const c = new SupabaseClient({ url: 'https://x.co', key: 'k', storage: memStore(), fetchImpl: async (u) => (u.includes('/auth/') ? resp(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u' } }) : resp(404, { message: 'relation "public.trades" does not exist' })) });
  await c.signIn('a', 'b');
  await assert.rejects(c.rest('trades'), (e) => e instanceof SyncError && e.code === 'schema');
  const net = new SupabaseClient({ url: 'https://x.co', key: 'k', storage: memStore(), fetchImpl: async () => { throw new TypeError('x'); } });
  await assert.rejects(net.signIn('a', 'b'), (e) => e.code === 'network');
});

test('client : inscription avec confirmation par e-mail', async () => {
  const c = new SupabaseClient({ url: 'https://x.co', key: 'k', storage: memStore(), fetchImpl: async () => resp(200, { id: 'u', email: 'a@b.c' }) });
  assert.deepEqual(await c.signUp('a@b.c', 'secret1'), { needsConfirmation: true });
  assert.equal(c.signedIn, false);
});
