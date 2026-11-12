import test from 'node:test';
import assert from 'node:assert/strict';
import { periodRange, shiftAnchor, inPeriod, periodLabel } from '../src/core/domain/period.js';

test('période : jour, semaine (lundi à dimanche), mois, année', () => {
  assert.deepEqual(periodRange('day', '2026-11-12'), { from: '2026-11-12', to: '2026-11-12' });
  assert.deepEqual(periodRange('week', '2026-11-12'), { from: '2026-11-09', to: '2026-11-15' }); // jeudi 12/11
  assert.deepEqual(periodRange('week', '2026-11-15'), { from: '2026-11-09', to: '2026-11-15' }); // dimanche
  assert.deepEqual(periodRange('week', '2026-11-09'), { from: '2026-11-09', to: '2026-11-15' }); // lundi
  assert.deepEqual(periodRange('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(periodRange('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(periodRange('year', '2026-06-01'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(periodRange('all', '2026-06-01'), { from: null, to: null });
});

test('période : précédent / suivant, y compris fin de mois et changement d\'année', () => {
  assert.equal(shiftAnchor('day', '2026-12-31', 1), '2027-01-01');
  assert.equal(shiftAnchor('week', '2026-01-03', -1), '2025-12-27');
  assert.equal(shiftAnchor('month', '2026-03-31', -1), '2026-02-28');
  assert.equal(shiftAnchor('month', '2026-12-15', 1), '2027-01-15');
  assert.equal(shiftAnchor('year', '2028-02-29', 1), '2029-02-28');
});

test('période : filtre et libellés', () => {
  const r = periodRange('week', '2026-11-12');
  assert.ok(inPeriod('2026-11-09', r) && inPeriod('2026-11-15', r));
  assert.ok(!inPeriod('2026-11-08', r) && !inPeriod('2026-11-16', r));
  assert.ok(inPeriod('1999-01-01', periodRange('all', '2026-01-01')));
  assert.match(periodLabel('month', '2026-11-12'), /novembre 2026/);
  assert.match(periodLabel('week', '2026-11-12'), /^9 au 15 nov/);
  assert.equal(periodLabel('year', '2026-11-12'), '2026');
});
