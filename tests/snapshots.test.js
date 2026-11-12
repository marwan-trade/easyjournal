import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryBackend } from '../src/core/store/db.js';
import { takeSnapshot, listSnapshots, withCurrentShots, MAX_SNAPSHOTS } from '../src/core/store/snapshots.js';

const data = (n) => ({ trades: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, pair: 'EURUSD', screenshot: 'data:image/jpeg;base64,AAAA' })), ideas: [], settings: { theme: 'dark' } });
const H = 3600 * 1000;

test('instantanés : un par jour au plus, sans les captures', async () => {
  const db = new MemoryBackend();
  assert.equal(await takeSnapshot(db, data(0), { now: 0 }), false); // rien à sauvegarder
  assert.equal(await takeSnapshot(db, data(3), { now: 1000 }), true);
  assert.equal(await takeSnapshot(db, data(4), { now: 1000 + 5 * H }), false); // le même jour
  assert.equal(await takeSnapshot(db, data(4), { now: 1000 + 21 * H }), true);
  const list = await listSnapshots(db);
  assert.equal(list.length, 2);
  assert.equal(list[0].counts.trades, 4);
  assert.ok(list.every((s) => s.trades.every((t) => !('screenshot' in t))));
});

test('instantanés : forcés (avant suppression), limités aux 7 derniers', async () => {
  const db = new MemoryBackend();
  for (let i = 0; i < 10; i++) await takeSnapshot(db, data(2), { now: i, force: true, reason: 'avant suppression' });
  const list = await listSnapshots(db);
  assert.equal(list.length, MAX_SNAPSHOTS);
  assert.equal(list[0].at, 9); // le plus récent d'abord
  assert.equal(list[0].reason, 'avant suppression');
});

test('restauration : les captures actuelles sont conservées', () => {
  const merged = withCurrentShots([{ id: 'a' }, { id: 'b' }], [{ id: 'a', screenshot: 'S' }, { id: 'c', screenshot: 'T' }]);
  assert.deepEqual(merged, [{ id: 'a', screenshot: 'S' }, { id: 'b' }]);
});
