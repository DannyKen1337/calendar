// Szervezői jogosultság csoportokból (szerveroldal).
// user_groups: { name, description, color, allowedCategories (null = minden játék), allowedStores (null = minden bolt), features: [] }
// users.groupIds: a felhasználó csoportjai; users.accessMode === 'groups': a jogait csak a csoportjai adják.
//  - Több csoport jogai összeadódnak (ha bármelyik csoport minden játékot / boltot kezelhet, akkor ő is).
//  - Csoport nélkül (accessMode 'groups' mellett) semmit nem kezelhet – így egy csoportból kivett szervező nem kap véletlenül mindenhez jogot.
//  - Régi felhasználó (még nincs csoportja, accessMode nincs): az egyénileg beállított jogai érvényesek, mint eddig.
import { ObjectId } from 'mongodb';
import { sanitizeCategories, sanitizeStores, sanitizeFeatures, FEATURES, STORE_NAMES } from '@/lib/permissions';
import { GAME_CONFIG } from '@/lib/gameConfig';

export const GROUP_COLORS = ['#E5B15D', '#1d4ed8', '#10b981', '#b91c1c', '#8b5cf6', '#f97316', '#ec4899', '#14b8c4', '#6b7280'];

export const usesGroups = (user) => user?.accessMode === 'groups';

const unionOrAll = (lists) => {
  if (lists.some(l => !Array.isArray(l))) return null; // valamelyik csoport mindent kezelhet
  return [...new Set(lists.flat())];
};

// A felhasználó tényleges jogai. groupsById: Map(csoport azonosító => csoport)
export function effectiveAccess(user, groupsById) {
  if (!usesGroups(user)) {
    return {
      allowedCategories: Array.isArray(user?.allowedCategories) ? user.allowedCategories : null,
      allowedStores: Array.isArray(user?.allowedStores) ? user.allowedStores : null,
      features: Array.isArray(user?.features) ? user.features : [],
    };
  }
  const groups = (user.groupIds || []).map(id => groupsById.get(String(id))).filter(Boolean);
  if (groups.length === 0) return { allowedCategories: [], allowedStores: [], features: [] };
  return {
    allowedCategories: unionOrAll(groups.map(g => g.allowedCategories)),
    allowedStores: unionOrAll(groups.map(g => g.allowedStores)),
    features: [...new Set(groups.flatMap(g => g.features || []))],
  };
}

export async function getGroupsMap(db, ids = null) {
  const query = ids ? { _id: { $in: ids.map(String).filter(id => ObjectId.isValid(id) && id.length === 24).map(id => new ObjectId(id)) } } : {};
  const groups = await db.collection('user_groups').find(query).toArray();
  return new Map(groups.map(g => [String(g._id), g]));
}

// Csoport adatainak ellenőrzése. { group } vagy { error }
export function sanitizeGroupInput(input) {
  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ');
  const description = String(input?.description ?? '').trim();
  if (!name || name.length > 60) return { error: 'A csoport neve kötelező (legfeljebb 60 karakter).' };
  if (description.length > 300) return { error: 'A leírás legfeljebb 300 karakter lehet.' };
  const color = /^#[0-9a-f]{6}$/i.test(String(input?.color || '')) ? input.color : GROUP_COLORS[0];
  const allowedCategories = input?.allCategories === true ? null : sanitizeCategories(input?.categories ?? []);
  const allowedStores = input?.allStores === true ? null : sanitizeStores(input?.stores ?? []);
  return { group: { name, description, color, allowedCategories, allowedStores, features: sanitizeFeatures(input?.features) } };
}

// A csoport fajtája (a felületen ez alapján csoportosítunk): egy játék, egy bolt, egy modul, vagy egyéni összeállítás
export function groupKind(g) {
  const cats = g.allowedCategories, stores = g.allowedStores, feats = g.features || [];
  if (Array.isArray(stores) && stores.length === 0 && feats.length === 0 && (cats === null || cats.length > 0)) return 'game';
  if (Array.isArray(cats) && cats.length === 0 && feats.length === 0 && (stores === null || stores.length > 0)) return 'store';
  if (Array.isArray(cats) && cats.length === 0 && Array.isArray(stores) && stores.length === 0 && feats.length > 0) return 'module';
  return 'custom';
}
export const GROUP_KIND_ORDER = { game: 0, store: 1, module: 2, custom: 3 };
// A felhasználókezelést adó csoport: ezt (és a tagságát) csak a tulajdonos módosíthatja
export const isProtectedGroup = (g) => (g?.features || []).includes('users');

const STORE_COLORS = { debrecen: '#E5B15D', miskolc: '#8b5cf6', jatekceh: '#10b981' };
const MODULE_COLORS = { preorders: '#f97316', leagues: '#14b8c4', users: '#b91c1c' };

// Az alapcsoportok: játékonként, boltonként és modulonként egy-egy építőkocka (a jogok összeadódnak),
// valamint „Minden játék” és „Minden bolt”
export function defaultGroups() {
  const games = Object.keys(GAME_CONFIG).map(g => ({ name: g, description: `Játék: ${g}`, color: GAME_CONFIG[g].color || '#6b7280', allowedCategories: [g], allowedStores: [], features: [] }));
  const stores = Object.entries(STORE_NAMES).map(([id, name]) => ({ name, description: `Bolt: ${name}`, color: STORE_COLORS[id] || '#6b7280', allowedCategories: [], allowedStores: [id], features: [] }));
  const modules = Object.entries(FEATURES).map(([key, name]) => ({ name, description: key === 'users' ? 'Hozzáférés a felhasználók és csoportok kezeléséhez' : `Modul: ${name}`, color: MODULE_COLORS[key] || '#6b7280', allowedCategories: [], allowedStores: [], features: [key] }));
  return [
    ...games,
    { name: 'Minden játék', description: 'Minden játék eseményeit kezelheti', color: '#E5B15D', allowedCategories: null, allowedStores: [], features: [] },
    ...stores,
    { name: 'Minden bolt', description: 'Minden bolt eseményeit kezelheti', color: '#E5B15D', allowedCategories: [], allowedStores: null, features: [] },
    ...modules,
  ];
}

// Az alapcsoportok létrehozása egyszer (a már létező, azonos nevű csoportokat nem duplikálja)
export async function seedDefaultGroups(db, createdBy) {
  const settings = db.collection('settings');
  const flag = await settings.findOne({ _id: 'default_groups_v1' });
  if (flag) return 0;
  const existing = await db.collection('user_groups').find({}, { projection: { name: 1 } }).toArray();
  const names = new Set(existing.map(g => g.name.toLowerCase()));
  const toCreate = defaultGroups().filter(g => !names.has(g.name.toLowerCase())).map(g => ({ ...g, createdAt: new Date(), createdBy: createdBy || 'Rendszer' }));
  if (toCreate.length) await db.collection('user_groups').insertMany(toCreate);
  await settings.updateOne({ _id: 'default_groups_v1' }, { $set: { at: new Date(), created: toCreate.length } }, { upsert: true });
  return toCreate.length;
}
