import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryFrom, findMatch, mergeEntry, newPlayer, sanitizePlayerInput, normName } from './playerBase.js';

const P = 'Pokémon TCG', R = 'Riftbound';

test('bejegyzés a jelentkezésből', () => {
  assert.deepEqual(entryFrom(P, { username: 'Ash', name: 'Kovács Ádám', email: ' ASH@x.hu ' }), { username: 'Ash', name: 'Kovács Ádám', email: 'ash@x.hu' });
  assert.deepEqual(entryFrom(P, { username: 'Ash', name: 'Ash' }), { username: 'Ash', name: '', email: '' });
  assert.deepEqual(entryFrom(R, { summoner: 'Garen#EUNE', email: 'x@x.hu' }), { summoner: 'Garen#EUNE' });
  assert.deepEqual(entryFrom(R, { username: 'Jinx#HUN' }), { summoner: 'Jinx#HUN' });
  assert.equal(entryFrom(P, {}), null);
});

test('egyezés: e-mail, név, Riftboundnál idézőnév', () => {
  const list = [
    { username: 'Ash', name: 'Kovács Ádám', email: 'ash@x.hu' },
    { username: 'Misty', name: 'Nagy Bianka', email: '' },
  ];
  assert.equal(findMatch(list, entryFrom(P, { username: 'Mas', email: 'ASH@x.hu' }), P), list[0]);
  assert.equal(findMatch(list, entryFrom(P, { name: 'kovacs adam' }), P), list[0]);
  assert.equal(findMatch(list, entryFrom(P, { username: 'Ash', email: 'masik@x.hu' }), P), undefined, 'azonos név, más e-mail: új játékos');
  assert.equal(findMatch(list, entryFrom(P, { username: 'misty', email: 'misty@x.hu' }), P), list[1], 'e-mail nélküli játékos az e-mailt megkapja');
  const rb = [{ summoner: 'Garen#EUNE', aliases: ['garen#eune'] }];
  assert.equal(findMatch(rb, entryFrom(R, { summoner: 'garen#eune' }), R), rb[0]);
  assert.equal(findMatch(rb, entryFrom(R, { summoner: 'Garen#HUN' }), R), undefined);
});

test('összevonás: hiányzó adatok, alkalmak, utolsó alkalom; a kézi adat marad', () => {
  let p = newPlayer(P, entryFrom(P, { username: 'Misty' }), { at: new Date('2026-10-01'), event: 'Liga 1' });
  p = mergeEntry({ ...p, name: 'Kézzel írt' }, entryFrom(P, { username: 'Misty', name: 'Nagy Bianka', email: 'm@x.hu' }), { at: new Date('2026-11-01'), event: 'Liga 2' });
  assert.equal(p.events, 2);
  assert.equal(p.name, 'Kézzel írt');
  assert.equal(p.email, 'm@x.hu');
  assert.equal(p.lastEvent, 'Liga 2');
  assert.equal(new Date(p.firstSeen).toISOString().slice(0, 10), '2026-10-01');
  assert.ok(p.aliases.includes(normName('Nagy Bianka')));
});

test('kézi szerkesztés', () => {
  assert.deepEqual(sanitizePlayerInput(P, { username: ' Ash ', playerId: '1234 5678', email: 'a@x.hu' }), { player: { note: '', username: 'Ash', name: '', playerId: '12345678' } }, 'e-mailt csak 2. szint írhat');
  assert.equal(sanitizePlayerInput(P, { username: 'Ash', playerId: 'abc' }).field, 'playerId');
  assert.equal(sanitizePlayerInput(P, { username: 'Ash', email: 'rossz' }, { canEmail: true }).field, 'email');
  assert.equal(sanitizePlayerInput(R, { username: 'x' }).field, 'summoner');
  assert.deepEqual(sanitizePlayerInput(R, { summoner: 'Garen#EUNE', playerId: '1' }), { player: { note: '', summoner: 'Garen#EUNE' } });
  assert.equal(sanitizePlayerInput('Magic: The Gathering', { name: 'Jace', playerId: '1' }).player.playerId, undefined);
});
