import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem } from './passwordPolicy.js';

test('jó jelszavak', () => {
  for (const pw of ['kek-alma-zongora', 'Tavern-Debrecen-77', 'hosszu jelszo szokozzel', 'a'.repeat(7) + 'b']) assert.equal(passwordProblem(pw, { username: 'Szervezo', email: 'x@y.hu' }), null, pw);
});

test('hossz', () => {
  assert.match(passwordProblem('rovid12'), /legalább 8/);
  assert.match(passwordProblem('x'.repeat(40) + 'y'.repeat(33)), /legfeljebb 72/);
  assert.match(passwordProblem(undefined), /legalább 8/);
  assert.match(passwordProblem({ length: 10 }), /legalább 8/);
});

test('gyakori és kitalálható jelszavak', () => {
  for (const pw of ['12345678', 'Password1', 'JELSZÓ123', 'jelszo123!', 'qwertz123', 'Tavern2026', 'aaaaaaaaaa']) assert.ok(passwordProblem(pw), pw);
});

test('nem tartalmazhatja a felhasználónevet vagy az e-mail címet', () => {
  assert.match(passwordProblem('kovacspeter99', { username: 'KovacsPeter' }), /felhasználónevet/);
  assert.match(passwordProblem('xx-szabo.anna-xx', { email: 'szabo.anna@gmail.com' }), /e-mail/);
  assert.equal(passwordProblem('nagyon-hosszu-jelszo', { username: 'Al' }), null); // 3 karakternél rövidebb név nem számít
});
