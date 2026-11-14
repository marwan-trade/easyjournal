/**
 * Moteur de synchronisation « local d'abord » : IndexedDB reste la référence de travail,
 * le cloud est une copie partagée entre tes appareils.
 * Règle de conflit : la modification la plus récente gagne (champ updatedAt), les suppressions
 * sont propagées par des « pierres tombales ». Aucune donnée n'est effacée sans signal explicite.
 */
import { shotKey, parseDataUrl, toDataUrl } from './shots.js';
import { mergeSettingSets, sameSettingSets } from '../store/settings.js';

const at = (x) => Number(x?.updatedAt ?? x?.createdAt ?? 0);
export const isDemoId = (id) => String(id).startsWith('demo-');
/** La capture elle-même va dans Supabase Storage (trop lourde pour la table) : la ligne du trade n'en garde que l'empreinte (shotKey). */
const forCloud = (t, fallbackKey = '') => { const { screenshot, ...rest } = t; return { ...rest, shotKey: shotKey(screenshot) || fallbackKey }; };

/** Fonction pure : compare local, pierres tombales et état distant ; dit quoi appliquer ici et quoi renvoyer. */
export function planMerge({ local, tombstones, remote }) {
  const plan = { apply: { trades: { upsert: [], remove: [] }, ideas: { upsert: [], remove: [] }, settings: null },
    push: { trades: new Set(), ideas: new Set(), tombs: { trades: new Set(), ideas: new Set() }, settings: false } };
  for (const kind of ['trades', 'ideas']) {
    const byId = new Map(local[kind].filter((x) => !isDemoId(x.id)).map((x) => [x.id, x]));
    for (const r of remote[kind]) {
      const rAt = Number(r.updated_at); const l = byId.get(r.id); const tomb = tombstones[kind]?.[r.id];
      if (r.deleted) {
        if (l && at(l) > rAt) plan.push[kind].add(r.id);        // modifié ici APRÈS la suppression distante : on le garde
        else if (l) plan.apply[kind].remove.push(r.id);
      } else if (tomb && tomb >= rAt) {
        plan.push.tombs[kind].add(r.id);                        // supprimé ici plus récemment : on renvoie la suppression
      } else if (!l) {
        plan.apply[kind].upsert.push({ ...r.data, id: r.id, updatedAt: rAt });
      } else if (at(l) < rAt) {
        plan.apply[kind].upsert.push({ ...r.data, id: r.id, updatedAt: rAt });
      } else if (at(l) > rAt) {
        plan.push[kind].add(r.id);
      }
    }
  }
  const rs = remote.settings; const ls = local.settings;
  if (!rs) plan.push.settings = true;
  else {
    const rset = { data: rs.data, at: Number(rs.updated_at), keyAt: rs.data?._keyAt };
    const lset = { data: ls.data, at: ls.at ?? 0, keyAt: ls.keyAt };
    const merged = mergeSettingSets(lset, rset);
    if (!sameSettingSets(merged, lset)) plan.apply.settings = merged;
    if (!sameSettingSets(merged, rset)) plan.push.settings = true;
  }
  return plan;
}

/**
 * Un cycle complet : récupérer, fusionner, envoyer.
 * @param {{client: object, adapter: object, now?: () => number}} o
 * @returns {{pulled:number, removed:number, pushed:number}}
 */
export async function runSync({ client, adapter, now = Date.now }) {
  const started = now();
  const meta = (await adapter.getMeta('sync')) ?? { lastPush: 0, lastPull: 0 };
  const local = { trades: adapter.trades().filter((t) => !isDemoId(t.id)), ideas: adapter.ideas(), settings: adapter.settings() };
  const tombstones = await adapter.tombstones();

  // 1. Récupérer (fenêtre de 24 h de marge : tolère les horloges décalées, la fusion est idempotente)
  const since = Math.max(0, meta.lastPull - 86400000);
  const remote = { trades: await client.pull('trades', since), ideas: await client.pull('ideas', since), settings: await client.pullSettings() };
  const plan = planMerge({ local, tombstones, remote });
  await adapter.applyRemote(plan.apply);

  // 1 bis. Captures : télécharger celles qui manquent sur cet appareil (les erreurs n'empêchent pas la synchro des données)
  const shotMeta = (await adapter.getMeta('shots')) ?? { up: {}, want: {} };
  const uid = client.user?.id ?? 'local';
  const upKey = (id) => `${uid}/${id}`;
  const shotErrors = [];
  const want = { ...shotMeta.want };
  const localById = new Map(adapter.trades().map((t) => [t.id, t]));
  for (const r of remote.trades) {
    if (r.deleted) continue;
    const l = localById.get(r.id);
    if (l && at(l) > Number(r.updated_at)) continue; // la version locale est plus récente (ex. capture retirée ici) : elle fait foi
    if (r.data?.shotKey) want[r.id] = r.data.shotKey; else if (r.data?.shotKey === '') delete want[r.id];
  }
  const fallbackKeys = {};
  if (client.downloadShot && adapter.setShot) {
    for (const [id, key] of Object.entries(want)) {
      const l = adapter.trades().find((t) => t.id === id);
      if (!l) { delete want[id]; continue; }
      if (l.screenshot) { if (shotKey(l.screenshot) === key) delete want[id]; continue; } // déjà là
      try {
        const got = await client.downloadShot(id);
        if (got) { await adapter.setShot(id, toDataUrl(got.bytes, got.mime)); shotMeta.up[upKey(id)] = key; delete want[id]; }
        else fallbackKeys[id] = key; // l'autre appareil n'a pas encore envoyé l'image
      } catch (e) { shotErrors.push(e); fallbackKeys[id] = key; if (e.code === 'network' || e.code === 'schema') break; }
    }
  }

  // 2. Envoyer : tout ce qui a changé depuis le dernier envoi, plus ce que la fusion a désigné
  const cut = meta.lastPush;
  const nowLocal = adapter.trades().filter((t) => !isDemoId(t.id));
  const uploaded = {}; const removedShots = [];
  if (client.uploadShot) {
    for (const t of nowLocal) {
      const key = shotKey(t.screenshot);
      if (key && shotMeta.up[upKey(t.id)] !== key) {
        try { const { bytes, mime } = parseDataUrl(t.screenshot); await client.uploadShot(t.id, bytes, mime); uploaded[t.id] = key; }
        catch (e) { shotErrors.push(e); if (e.code === 'network' || e.code === 'schema') break; }
      } else if (!key && shotMeta.up[upKey(t.id)] && !fallbackKeys[t.id] && !want[t.id]) {
        try { await client.deleteShot(t.id); removedShots.push(t.id); } catch (e) { shotErrors.push(e); }
      }
    }
  }
  const tradeRows = nowLocal.filter((t) => at(t) >= cut || plan.push.trades.has(t.id) || uploaded[t.id])
    .map((t) => ({ id: t.id, mode: t.mode, date: t.date, data: forCloud(t, fallbackKeys[t.id] ?? ''), updated_at: uploaded[t.id] ? Math.max(at(t), started) : at(t), deleted: false }));
  const ideaRows = local.ideas.filter((i) => at(i) >= cut || plan.push.ideas.has(i.id))
    .map((i) => ({ id: i.id, data: i, updated_at: at(i), deleted: false }));
  const tombRows = (kind) => Object.entries(tombstones[kind] ?? {})
    .filter(([id, ts]) => !isDemoId(id) && (ts >= cut || plan.push.tombs[kind].has(id)))
    .map(([id, ts]) => ({ id, data: {}, updated_at: ts, deleted: true }));
  await client.upsert('trades', [...tradeRows, ...tombRows('trades')]);
  await client.upsert('ideas', [...ideaRows, ...tombRows('ideas')]);
  const ls = adapter.settings();
  if (plan.push.settings || (ls.at ?? 0) >= cut) await client.upsert('user_settings', [{ data: { ...ls.data, _keyAt: ls.keyAt ?? {} }, updated_at: Math.max(ls.at || 0, started) }], 'user_id');

  // Captures des trades supprimés : on les efface aussi du stockage.
  if (client.deleteShot) {
    for (const id of Object.keys(tombstones.trades ?? {})) {
      if (shotMeta.up[upKey(id)] === undefined) continue;
      try { await client.deleteShot(id); delete shotMeta.up[upKey(id)]; } catch (e) { shotErrors.push(e); }
    }
  }
  for (const [id, key] of Object.entries(uploaded)) shotMeta.up[upKey(id)] = key;
  for (const id of removedShots) delete shotMeta.up[upKey(id)];
  await adapter.setMeta('shots', { up: shotMeta.up, want });

  await adapter.setMeta('sync', { lastPush: started, lastPull: started });
  return { pulled: plan.apply.trades.upsert.length + plan.apply.ideas.upsert.length,
    removed: plan.apply.trades.remove.length + plan.apply.ideas.remove.length,
    pushed: tradeRows.length + ideaRows.length + tombRows('trades').length + tombRows('ideas').length,
    shotsError: shotErrors[0]?.message ?? '' };
}
