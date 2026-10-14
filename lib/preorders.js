// Előrendelés (feliratkozási lista): közös, kliens- és szerveroldalon is használható segédfüggvények.
// Adatbázis: preorder_products (a meghirdetett termékek, játékonként), preorders (egy sor = egy ember egy termékre).
import { GAME_CONFIG } from '@/lib/gameConfig';

export const PREORDER_MAX_QTY = 10;
export const PREORDER_MAX_ITEMS = 30;
export const PRODUCT_NAME_MAX = 120;
export const PRODUCT_DESC_MAX = 1000;
export const PRODUCT_RELEASE_MAX = 60;

// A játékok sorrendje a GAME_CONFIG szerint, az "Egyéb" a végén
export const PREORDER_GAMES = Object.keys(GAME_CONFIG);

export const preorderLink = (origin, productId) => `${origin}/elorendeles${productId ? `?termek=${encodeURIComponent(productId)}` : ''}`;

// Telefonszám: számjegyek, szóköz, +, kötőjel, zárójel, perjel; 6-15 számjegy. null, ha érvénytelen.
export function normalizePhone(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!/^\+?[\d ()/-]{6,25}$/.test(s)) return null;
  const digits = s.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 15 ? s : null;
}

export function normalizeQuantity(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= PREORDER_MAX_QTY ? n : null;
}

// Admin által beküldött termékadatok ellenőrzése. { product } vagy { error }
export function sanitizeProductInput(input) {
  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ');
  const category = String(input?.category ?? '');
  const description = String(input?.description ?? '').trim();
  const releaseDate = String(input?.releaseDate ?? '').trim();
  if (!name || name.length > PRODUCT_NAME_MAX) return { error: `A termék neve kötelező (legfeljebb ${PRODUCT_NAME_MAX} karakter).` };
  if (!GAME_CONFIG[category]) return { error: 'Válassz játékot.' };
  if (description.length > PRODUCT_DESC_MAX) return { error: `A leírás legfeljebb ${PRODUCT_DESC_MAX} karakter lehet.` };
  if (releaseDate.length > PRODUCT_RELEASE_MAX) return { error: `A megjelenés legfeljebb ${PRODUCT_RELEASE_MAX} karakter lehet.` };
  return { product: { name, category, description, releaseDate } };
}

// Termékek csoportosítása játék szerint a PREORDER_GAMES sorrendjében
export function groupByGame(products) {
  const byGame = new Map();
  (products || []).forEach(p => {
    if (!byGame.has(p.category)) byGame.set(p.category, []);
    byGame.get(p.category).push(p);
  });
  const order = (g) => { const i = PREORDER_GAMES.indexOf(g); return i === -1 ? PREORDER_GAMES.length : i; };
  return [...byGame.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([game, items]) => ({ game, items }));
}
