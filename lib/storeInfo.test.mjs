// A Google-jelölés dátumai (futtatás: npm run test:unit)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budapestIso, eventJsonLd } from './storeInfo.js';

test('magyar helyi idő télen +01:00, nyáron +02:00', () => {
  assert.equal(budapestIso('2026-11-11T17:30'), '2026-11-11T17:30:00+01:00');
  assert.equal(budapestIso('2026-07-01T18:00'), '2026-07-01T18:00:00+02:00');
});

test('hibás dátumra nincs jelölés', () => {
  assert.equal(budapestIso('2026-13-45T99:99'), null);
  assert.equal(eventJsonLd({ name: 'x', date: '2026-02-30T10:00' }, 'a'), null);
});

test('régi, időzónás (UTC) dátum: a pontos időpont magyar időben', () => {
  assert.equal(budapestIso('2025-01-01T17:00:00.000Z'), '2025-01-01T18:00:00+01:00');
});

test('időzóna-váltás napján hajnalban a váltás előtti eltolás', () => {
  assert.equal(budapestIso('2026-10-25T01:30'), '2026-10-25T01:30:00+02:00');
  assert.equal(budapestIso('2026-03-29T01:30'), '2026-03-29T01:30:00+01:00');
});
