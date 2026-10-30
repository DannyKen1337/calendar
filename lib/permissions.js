import { GAME_CONFIG } from '@/lib/gameConfig';

// Szervezői (admin) jogosultság játékonként.
// allowedCategories: null / hiányzik => minden játékot kezelhet (a meglévő adminok így nem veszítenek jogot);
// tömb => csak ezeknek a játékoknak az eseményeit szerkesztheti és csak ezek jelentkezőit látja.
// A tulajdonos (owner) mindig mindent kezelhet.

export const eventCategory = (evt) => evt?.category || 'Egyéb';

export function canManageCategory(user, category) {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (user.role !== 'admin') return false;
  if (!Array.isArray(user.allowedCategories)) return true;
  return user.allowedCategories.includes(category || 'Egyéb');
}

// Szervezői jogosultság boltonként. allowedStores: null / hiányzik => minden bolt (a meglévő szervezők így nem veszítenek jogot);
// tömb => csak ezeknek a boltoknak az eseményeit hozhatja létre és szerkesztheti, és csak ezek jelentkezőit látja.
// A többi bolt eseményei a naptárban továbbra is látszanak neki, csak nem szerkesztheti őket.
export const STORE_NAMES = { debrecen: 'Tavern Debrecen', miskolc: 'Tavern Miskolc', jatekceh: 'JátékCéh' };
export const eventStore = (evt) => evt?.store || 'debrecen'; // a bolt nélküli (régi) események Debrecenhez tartoznak

export function canManageStore(user, store) {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (user.role !== 'admin') return false;
  if (!Array.isArray(user.allowedStores)) return true;
  return user.allowedStores.includes(store || 'debrecen');
}

// Eseményt az kezelhet, aki a játékát és a boltját is kezelheti
export const canManageEvent = (user, evt) => canManageCategory(user, eventCategory(evt)) && canManageStore(user, eventStore(evt));

// Tulajdonos által beküldött bolt-lista ellenőrzése: csak ismert boltok. null = minden bolt.
export function sanitizeStores(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(s => typeof s === 'string' && Object.hasOwn(STORE_NAMES, s)))];
}

// Külön engedélyhez kötött modulok. A tulajdonos mindig hozzáfér; a szervezők csak akkor,
// ha a tulajdonos megadta nekik (users.features). Alapból senki nem kapja meg.
export const FEATURES = {
  preorders: 'Előrendelések',
  leagues: 'Ligák',
  users: 'Felhasználók és csoportok',
  website: 'Weblap mester', // a Tavern weboldal (hírek) szerkesztőfelülete, ugyanezzel a fiókkal
};

// Felhasználók és csoportok kezelése: a tulajdonos, illetve akinek a csoportja ezt megengedi
export const canManageUsers = (user) => hasFeature(user, 'users');

export function hasFeature(user, feature) {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (user.role !== 'admin') return false;
  return Array.isArray(user.features) && user.features.includes(feature);
}

export function sanitizeFeatures(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(f => typeof f === 'string' && Object.hasOwn(FEATURES, f)))];
}

// Tulajdonos által beküldött lista ellenőrzése: csak ismert játékok, duplikáció nélkül. null = minden játék.
export function sanitizeCategories(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(c => typeof c === 'string' && GAME_CONFIG[c]))];
}
