import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leagueUrl, leagueSlugOf, newLeagueSlug } from './leagueSlug.js';

test('a liga linkje: a saját slug, a régi ligáknál a játék neve', () => {
  assert.equal(leagueUrl('One Piece Card Game'), '/liga/one-piece-card-game');
  assert.equal(leagueUrl({ category: 'Pokémon TCG' }), '/liga/pokemon-tcg');
  assert.equal(leagueUrl({ category: 'One Piece Card Game', slug: 'one-piece-liga-miskolc' }), '/liga/one-piece-liga-miskolc');
  assert.equal(leagueSlugOf({ category: 'Magic: The Gathering' }), 'magic-the-gathering');
});

test('új liga linkje: az első a játék nevét kapja, a többi a liga nevét, foglaltnál sorszámmal', () => {
  assert.equal(newLeagueSlug([], 'One Piece Card Game', 'One Piece liga'), 'one-piece-card-game');
  const one = [{ category: 'One Piece Card Game' }];
  assert.equal(newLeagueSlug(one, 'One Piece Card Game', 'One Piece liga – Miskolc'), 'one-piece-liga-miskolc');
  const two = [...one, { category: 'One Piece Card Game', slug: 'one-piece-liga-miskolc' }];
  assert.equal(newLeagueSlug(two, 'One Piece Card Game', 'One Piece liga – Miskolc'), 'one-piece-liga-miskolc-2');
  assert.equal(newLeagueSlug(one, 'One Piece Card Game', 'One Piece Card Game'), 'one-piece-card-game-2');
});
