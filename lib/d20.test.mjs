import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D20_FACES, topFaceFor } from './d20.js';

test('D20: 20 lap, 1–20 egyszer, szemközti lapok összege 21', () => {
  assert.equal(D20_FACES.length, 20);
  assert.deepEqual(D20_FACES.map(f => f.num).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const f of D20_FACES) {
    const opp = D20_FACES.find(g => g.n[0] * f.n[0] + g.n[1] * f.n[1] + g.n[2] * f.n[2] < -0.999);
    assert.equal(f.num + opp.num, 21);
  }
});

test('D20: minden kidobott számnál az a lap néz felfelé', () => {
  for (let n = 1; n <= 20; n++) assert.equal(topFaceFor(n), n);
});
