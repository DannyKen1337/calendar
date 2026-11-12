// A Galéria mappa-feltöltésének és sorrendjének tesztjei (futtatás: node --test weblap/lib/albums.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { albumsFromFiles, dateFromName, gameFromName, cleanName, findAlbum, visibleAlbums, albumDate } from './albums.js';

const f = (path, lastModified = Date.UTC(2026, 10, 8)) => ({ name: path.split('/').pop(), type: /\.txt$/.test(path) ? 'text/plain' : 'image/jpeg', path, lastModified });

test('dátum és játék a mappanévből', () => {
  assert.equal(dateFromName('Pokeween 2026-10-31'), '2026-10-31');
  assert.equal(dateFromName('2026.11.08. Riftbound'), '2026-11-08');
  assert.equal(dateFromName('prerelease_20261115'), '2026-11-15');
  assert.equal(dateFromName('Pokeween'), '');
  assert.equal(gameFromName('Pokeween 2026'), 'Pokémon TCG');
  assert.equal(gameFromName('Riftbound Skirmish'), 'Riftbound');
  assert.equal(gameFromName('MTG Commander est'), 'Magic: The Gathering');
  assert.equal(gameFromName('Nyári party'), '');
  assert.equal(cleanName('pokeween_2026-10-31'), 'Pokeween');
  assert.equal(cleanName('2026.11.08. - Riftbound Skirmish'), 'Riftbound Skirmish');
});

test('mappánként egy album; a kiválasztott gyűjtőmappa neve nem kerül a címbe', () => {
  const albums = albumsFromFiles([
    f('Események/Pokémon/Prerelease 2026-11-08/IMG_10.jpg'),
    f('Események/Pokémon/Prerelease 2026-11-08/IMG_2.jpg'),
    f('Események/Pokeween 2026-10-31/a.jpg'),
    f('Események/Riftbound Skirmish/x.png', Date.UTC(2026, 9, 3)),
    f('Események/Riftbound Skirmish/jegyzet.txt'),
  ]);
  assert.deepEqual(albums.map(a => [a.title, a.date, a.game, a.files.length]), [
    ['Pokémon Prerelease', '2026-11-08', 'Pokémon TCG', 2],
    ['Pokeween', '2026-10-31', 'Pokémon TCG', 1],
    ['Riftbound Skirmish', '2026-10-03', 'Riftbound', 1],
  ]);
  assert.deepEqual(albums[0].files.map(x => x.name), ['IMG_2.jpg', 'IMG_10.jpg'], 'a képek a fájlnév szerint, számok szerint');
});

test('ha közvetlenül a kiválasztott mappában vannak a képek, az az album', () => {
  const albums = albumsFromFiles([f('Pokeween 2026-10-31/1.jpg'), f('Pokeween 2026-10-31/2.jpg')]);
  assert.deepEqual(albums.map(a => [a.title, a.date, a.files.length]), [['Pokeween', '2026-10-31', 2]]);
});

test('újra feltöltött mappa a meglévő albumba kerül; az oldal sorrendje', () => {
  const list = [{ title: 'Pokeween', date: '2026-10-31' }, { title: 'Riftbound Skirmish', date: '' }];
  assert.equal(findAlbum(list, { title: 'pokeween', date: '2026-10-31' }), 0);
  assert.equal(findAlbum(list, { title: 'Pokeween', date: '2025-10-31' }), -1);
  const pic = { picture: { src: '/x.jpg' } };
  const shown = visibleAlbums([
    { title: 'Régi', date: '2025-01-01', pictures: [pic] },
    { title: 'Üres', date: '2026-12-01', pictures: [] },
    { title: 'Dátum nélkül', date: '', pictures: [pic] },
    { title: 'Új', date: '2026-11-08', pictures: [pic] },
  ]);
  assert.deepEqual(shown.map(a => a.title), ['Új', 'Régi', 'Dátum nélkül']);
  assert.equal(albumDate('2026-10-31'), '2026. október 31.');
});

test('Google Drive: a mappa linkje és a kép ideje', async () => {
  const { driveFolderId, driveTime } = await import('./albums.js');
  assert.equal(driveFolderId('https://drive.google.com/drive/folders/1AbC_def-GHIjkl?usp=sharing'), '1AbC_def-GHIjkl');
  assert.equal(driveFolderId('https://drive.google.com/drive/u/0/folders/1AbC_def-GHIjkl'), '1AbC_def-GHIjkl');
  assert.equal(driveFolderId('https://drive.google.com/open?id=1AbC_def-GHIjkl'), '1AbC_def-GHIjkl');
  assert.equal(driveFolderId('1AbC_def-GHIjkl'), '1AbC_def-GHIjkl');
  assert.equal(driveFolderId('https://example.com/kep.jpg'), null);
  assert.equal(new Date(driveTime({ imageMediaMetadata: { time: '2026:10:31 18:22:01' } })).toISOString().slice(0, 10), '2026-10-31');
  assert.equal(new Date(driveTime({ createdTime: '2026-11-08T10:00:00Z' })).toISOString().slice(0, 10), '2026-11-08');
});
