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

export const canManageEvent = (user, evt) => canManageCategory(user, eventCategory(evt));

// Tulajdonos által beküldött lista ellenőrzése: csak ismert játékok, duplikáció nélkül. null = minden játék.
export function sanitizeCategories(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(c => typeof c === 'string' && GAME_CONFIG[c]))];
}
