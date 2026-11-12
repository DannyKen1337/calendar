// A Galéria albumai: mappák feltöltése (mappánként egy album, a névből dátum és játék), és a Galéria oldal sorrendje.
// Nincs benne szerver- vagy böngészőfüggő kód, így a szerkesztőfelület és a teszt (albums.test.mjs) is használja.

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|dng)$/i;
export const isImageFile = (file) => (file.type ? file.type.startsWith('image/') : false) || IMAGE_EXT.test(file.name || '');

// A mappanévben lévő dátum: 2026-11-08, 2026.11.08., 2026_11_08, 20261108 (az év 2000 utáni); visszaad: "2026-11-08" vagy ''
const DATE_RE = /(20\d{2})[-._ ]?(0[1-9]|1[0-2])[-._ ]?(0[1-9]|[12]\d|3[01])\.?/;
export function dateFromName(name) {
  const m = String(name || '').match(DATE_RE);
  if (!m) return '';
  const v = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? '' : v;
}

// A játék kitalálása a névből (a Galéria szűrőjéhez); '' ha nem derül ki
const GAME_WORDS = [
  [/pok[eé]mon|pokeween|pikachu|\bptcg\b/i, 'Pokémon TCG'],
  [/one ?piece|\bop-?\d+/i, 'One Piece Card Game'],
  [/riftbound/i, 'Riftbound'],
  [/magic|\bmtg\b|commander/i, 'Magic: The Gathering'],
  [/warhammer|40k|kill ?team|age of sigmar/i, 'Warhammer'],
  [/lorcana/i, 'Disney Lorcana'],
  [/yu-?gi-?oh/i, 'Yu-Gi-Oh!'],
  [/flesh and blood|\bfab\b/i, 'Flesh and Blood'],
  [/cyberpunk/i, 'CyberPunk TCG'],
  [/t[aá]rsas|board ?game/i, 'Társasjáték'],
];
export function gameFromName(name) {
  return GAME_WORDS.find(([re]) => re.test(String(name || '')))?.[1] || '';
}

// A mappanév szépítve: a dátum és a felesleges jelek nélkül ("pokeween_2026-10-31" → "Pokeween")
export function cleanName(name) {
  const t = String(name || '').replace(DATE_RE, ' ').replace(/[_]+/g, ' ').replace(/\s*[-–]\s*$/, '').replace(/^\s*[-–]\s*/, '').replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

// A kiválasztott mappa fájljai albumokba csoportosítva. files: [{ name, type, path, lastModified }], ahol path a mappán belüli
// út (a böngésző webkitRelativePath-ja, pl. "Események/Pokeween 2026-10-31/IMG_1.jpg").
// Minden képet tartalmazó mappából egy album lesz. A cím a mappa útjából jön; a legfelső (kiválasztott) mappa neve csak akkor
// része a címnek, ha közvetlenül benne vannak a képek. Visszaad: [{ key, title, date, game, files }] (a mappák ábécérendjében).
export function albumsFromFiles(files) {
  const groups = new Map();
  for (const file of files) {
    if (!isImageFile(file)) continue;
    const parts = String(file.path || file.name).split('/').filter(Boolean);
    parts.pop(); // a fájlnév
    const key = parts.join('/') || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'hu')).map(([key, list]) => {
    const parts = key ? key.split('/') : [];
    const named = parts.length > 1 ? parts.slice(1) : parts;
    const title = named.map(cleanName).filter(Boolean).join(' ') || cleanName(parts[0]) || 'Új album';
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'hu', { numeric: true }));
    const oldest = Math.min(...sorted.map(f => f.lastModified || Infinity));
    const fromFiles = Number.isFinite(oldest) ? new Date(oldest).toISOString().slice(0, 10) : '';
    return {
      key,
      title,
      date: [...parts].reverse().map(dateFromName).find(Boolean) || fromFiles,
      game: [...parts].reverse().map(gameFromName).find(Boolean) || '',
      files: sorted,
    };
  });
}

// Melyik meglévő albumba kerüljön a feltöltött mappa: azonos cím és dátum esetén a meglévőbe (újra feltöltött mappa)
export function findAlbum(albums, { title, date }) {
  const norm = (v) => String(v || '').toLowerCase().trim();
  return albums.findIndex(a => norm(a.title) === norm(title) && (a.date || '') === (date || ''));
}

// A Galéria oldal sorrendje: a legfrissebb esemény elöl, a dátum nélküliek a végén (a szerkesztőfelület sorrendjében).
// Csak a képet tartalmazó albumok látszanak.
export function visibleAlbums(albums) {
  return (albums || [])
    .filter(a => a.pictures?.some(p => p.picture?.src))
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (y.a.date || '').localeCompare(x.a.date || '') || x.i - y.i)
    .map(({ a }) => a);
}

// "2026. október 31."
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
export function albumDate(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}. ${MONTHS[+m[2] - 1]} ${+m[3]}.` : '';
}
