/**
 * Moteur de synchronisation « local d'abord » : IndexedDB reste la référence de travail,
 * le cloud est une copie partagée entre tes appareils.
 * Règle de conflit : la modification la plus récente gagne (champ updatedAt), les suppressions
 * sont propagées par des « pierres tombales ». Aucune donnée n'est effacée sans signal explicite.
 */
const at = (x) => Number(x?.updatedAt ?? x?.createdAt ?? 0);
export const isDemoId = (id) => String(id).startsWith('demo-');
/** Les captures d'écran restent sur l'appareil (trop lourdes pour la table) : on n'envoie que les données du trade. */
const forCloud = (t) => { const { screenshot, ...rest } = t; return rest; };

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
  if (rs && Number(rs.updated_at) > (ls.at ?? 0)) plan.apply.settings = { data: rs.data, at: Number(rs.updated_at) };
  else if (!rs || Number(rs.updated_at) < (ls.at ?? 0)) plan.push.settings = true;
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

  // 2. Envoyer : tout ce qui a changé depuis le dernier envoi, plus ce que la fusion a désigné
  const cut = meta.lastPush;
  const tradeRows = local.trades.filter((t) => at(t) >= cut || plan.push.trades.has(t.id))
    .map((t) => ({ id: t.id, mode: t.mode, date: t.date, data: forCloud(t), updated_at: at(t), deleted: false }));
  const ideaRows = local.ideas.filter((i) => at(i) >= cut || plan.push.ideas.has(i.id))
    .map((i) => ({ id: i.id, data: i, updated_at: at(i), deleted: false }));
  const tombRows = (kind) => Object.entries(tombstones[kind] ?? {})
    .filter(([id, ts]) => !isDemoId(id) && (ts >= cut || plan.push.tombs[kind].has(id)))
    .map(([id, ts]) => ({ id, data: {}, updated_at: ts, deleted: true }));
  await client.upsert('trades', [...tradeRows, ...tombRows('trades')]);
  await client.upsert('ideas', [...ideaRows, ...tombRows('ideas')]);
  const ls = adapter.settings();
  if (plan.push.settings || (ls.at ?? 0) >= cut) await client.upsert('user_settings', [{ data: ls.data, updated_at: ls.at || started }], 'user_id');

  await adapter.setMeta('sync', { lastPush: started, lastPull: started });
  return { pulled: plan.apply.trades.upsert.length + plan.apply.ideas.upsert.length,
    removed: plan.apply.trades.remove.length + plan.apply.ideas.remove.length,
    pushed: tradeRows.length + ideaRows.length + tombRows('trades').length + tombRows('ideas').length };
}
