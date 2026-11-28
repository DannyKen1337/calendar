// A tesztkörnyezet kapcsolói (lib/testEnv.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isTestEnv, isLocalTest, isTestUser, liveUrlFor } from './testEnv.js';

test('a helyi tesztkörnyezet csak TEST_ENV=1 mellett él', () => {
  assert.equal(isLocalTest({ TEST_ENV: '1', TEST_LOCAL: '1' }), true);
  assert.equal(isLocalTest({ TEST_LOCAL: '1' }), false);
  assert.equal(isLocalTest({ TEST_ENV: '1' }), false);
  assert.equal(isTestEnv({}), false);
});

test('tesztfiókok: kis/nagybetű és szóköz nem számít', () => {
  const env = { TEST_USERS: 'admin.DannyKen, TavernAdmin' };
  assert.equal(isTestUser('admin.dannyken', env), true);
  assert.equal(isTestUser('tavernadmin', env), true);
  assert.equal(isTestUser('valaki', env), false);
});

test('belépés nélkül az élő oldal ugyanazon címe (a gyökér a naptár)', () => {
  assert.equal(liveUrlFor('http://localhost:3100/'), 'https://www.tavern.hu/naptar');
  assert.equal(liveUrlFor('http://localhost:3100/hirek?x=1'), 'https://www.tavern.hu/hirek?x=1');
});
