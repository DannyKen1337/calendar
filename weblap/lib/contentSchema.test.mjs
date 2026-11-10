// A tartalomséma tesztjei (futtatás: node --test weblap/lib/contentSchema.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabByKey, sanitizeField, emptyValue, isEditableTab, EDITABLE_TABS } from './contentSchema.js';

const pic = (i, caption = '') => ({ picture: { src: `https://i.ibb.co/x/${i}.jpg`, alt: '', position: '50% 50%' }, caption });

test('a szerkesztőfelületen csak a Galéria és a Képfal szerkeszthető', () => {
  assert.deepEqual(EDITABLE_TABS, ['gallery', 'slideshow']);
  assert.equal(isEditableTab('slideshow'), true);
  assert.equal(isEditableTab('gallery'), true);
  assert.equal(isEditableTab('hero'), false);
  assert.equal(isEditableTab('nincs-ilyen'), false);
});

test('a Képfal legfeljebb 40 képet enged', () => {
  const tab = tabByKey('slideshow');
  const errors = [];
  const out = sanitizeField(tab.schema, { title: 'A boltokból', pictures: Array.from({ length: 41 }, (_, i) => pic(i)) }, emptyValue(tab.schema), errors);
  assert.ok(errors.some(e => e.includes('legfeljebb 40 kép')), errors.join('\n'));
  assert.equal(out.pictures.length, 40);
});

test('a Képfal felirata és címe legfeljebb 40 karakter', () => {
  const tab = tabByKey('slideshow');
  const out = sanitizeField(tab.schema, { title: 'c'.repeat(60), pictures: [pic(1, 'f'.repeat(60))] }, emptyValue(tab.schema), []);
  assert.equal(out.title.length, 40);
  assert.equal(out.pictures[0].caption.length, 40);
  assert.ok(out.pictures[0].id, 'új kép azonosítót kap');
});

test('kép nélküli képfal-elem hibát ad', () => {
  const tab = tabByKey('slideshow');
  const errors = [];
  sanitizeField(tab.schema, { title: 'x', pictures: [{ picture: { src: '' }, caption: 'üres' }] }, emptyValue(tab.schema), errors);
  assert.ok(errors.some(e => e.includes('nincs kép')), errors.join('\n'));
});
