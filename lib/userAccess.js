// Szervezői jogosultság csoportokból (szerveroldal).
// user_groups: { name, description, color, allowedCategories (null = minden játék), allowedStores (null = minden bolt), features: [] }
// users.groupIds: a felhasználó csoportjai; users.accessMode === 'groups': a jogait csak a csoportjai adják.
//  - Több csoport jogai összeadódnak (ha bármelyik csoport minden játékot / boltot kezelhet, akkor ő is).
//  - Csoport nélkül (accessMode 'groups' mellett) semmit nem kezelhet – így egy csoportból kivett szervező nem kap véletlenül mindenhez jogot.
//  - Régi felhasználó (még nincs csoportja, accessMode nincs): az egyénileg beállított jogai érvényesek, mint eddig.
import { ObjectId } from 'mongodb';
import { sanitizeCategories, sanitizeStores, sanitizeFeatures } from '@/lib/permissions';

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
  const color = GROUP_COLORS.includes(input?.color) ? input.color : GROUP_COLORS[0];
  const allowedCategories = input?.allCategories === true ? null : sanitizeCategories(input?.categories ?? []);
  const allowedStores = input?.allStores === true ? null : sanitizeStores(input?.stores ?? []);
  return { group: { name, description, color, allowedCategories, allowedStores, features: sanitizeFeatures(input?.features) } };
}
