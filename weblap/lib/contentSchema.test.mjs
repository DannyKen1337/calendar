// A tartalomséma tesztjei (futtatás: node --test weblap/lib/contentSchema.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabByKey, sanitizeField, emptyValue, isEditableTab, EDITABLE_TABS } from './contentSchema.js';

const pic = (i, caption = '') => ({ picture: { src: `https://i.ibb.co/x/${i}.jpg`, alt: '', position: '50% 50%' }, caption });

test('a szerkesztőfelületen csak a Galéria (albumok) és a főoldali fotók szerkeszthető (a Képfal megszűnt)', () => {
  assert.deepEqual(EDITABLE_TABS, ['albums', 'gallery']);
  assert.equal(isEditableTab('gallery'), true);
  assert.equal(isEditableTab('slideshow'), false);
  assert.equal(tabByKey('slideshow'), undefined);
  assert.equal(isEditableTab('hero'), false);
  assert.equal(isEditableTab('nincs-ilyen'), false);
});

test('a főoldali fotók legfeljebb 3 képet engednek, cím nélkül', () => {
  const tab = tabByKey('gallery');
  const errors = [];
  const out = sanitizeField(tab.schema, { title: 'Régi cím', note: 'x', pictures: Array.from({ length: 4 }, (_, i) => pic(i)) }, emptyValue(tab.schema), errors);
  assert.ok(errors.some(e => e.includes('legfeljebb 3 kép')), errors.join('\n'));
  assert.equal(out.pictures.length, 3);
  assert.equal(out.title, undefined);
  assert.ok(out.pictures[0].id, 'új kép azonosítót kap');
});

test('kép nélküli fotó hibát ad', () => {
  const tab = tabByKey('gallery');
  const errors = [];
  sanitizeField(tab.schema, { note: 'x', pictures: [{ picture: { src: '' } }] }, emptyValue(tab.schema), errors);
  assert.ok(errors.some(e => e.includes('nincs kép')), errors.join('\n'));
});

test('Albumok: dátum, játék, bolt és a kép kisebb változata', () => {
  const tab = tabByKey('albums');
  const errors = [];
  const album = { title: 'Pokeween', date: '2026-10-31', game: 'Pokémon TCG', store: 'debrecen', pictures: [{ picture: { src: 'https://i.ibb.co/a/1.jpg', thumb: 'https://i.ibb.co/b/1.jpg', alt: '', position: '50% 50%' }, caption: '' }] };
  const out = sanitizeField(tab.schema, { title: 'Galéria', lead: '', albums: [album] }, emptyValue(tab.schema), errors);
  assert.deepEqual(errors, []);
  assert.equal(out.albums[0].date, '2026-10-31');
  assert.equal(out.albums[0].game, 'Pokémon TCG');
  assert.equal(out.albums[0].pictures[0].picture.thumb, 'https://i.ibb.co/b/1.jpg');
  const bad = [];
  sanitizeField(tab.schema, { albums: [{ ...album, date: '2026-13-45', game: 'Sakk', store: 'budapest' }] }, emptyValue(tab.schema), bad);
  assert.equal(bad.length, 3, bad.join('\n'));
  const noThumb = sanitizeField(tab.schema, { albums: [{ ...album, pictures: [{ picture: { src: '/photos/a.png', thumb: 'javascript:alert(1)' } }] }] }, emptyValue(tab.schema), []);
  assert.equal(noThumb.albums[0].pictures[0].picture.thumb, undefined);
});
