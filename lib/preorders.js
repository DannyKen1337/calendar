// Előrendelés (feliratkozási lista): közös, kliens- és szerveroldalon is használható segédfüggvények.
// Adatbázis: preorder_products (a meghirdetett termékek, játékonként), preorders (egy sor = egy ember egy termékre).
import { GAME_CONFIG } from '@/lib/gameConfig';

// Egy jelentkezésben egy termékből legfeljebb ennyi darab adható meg (elírás ellen), ha a termék limitje nem kisebb
export const PREORDER_MAX_QTY = 99;
export const PRODUCT_STOCK_MAX = 100000;
export const PRODUCT_LIMIT_MAX = 999;
export const PRODUCT_PRICE_MAX = 10000000; // Ft
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

// Telefonszám összehasonlításhoz: csak számjegyek, a belföldi "06" előtag "36"-ra cserélve
// (így a "+36 30 123 4567" és a "06301234567" ugyanannak számít a személyenkénti limitnél)
export function phoneKey(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('06')) return `36${digits.slice(2)}`;
  if (digits.startsWith('0036')) return digits.slice(2);
  return digits;
}

// Termék beállításai: stock = elérhető darab (null: nincs felső határ), perPersonLimit = darab / fő (0: korlátlan)
export const productStock = (p) => (Number.isInteger(p?.stock) && p.stock > 0 ? p.stock : null);
export const productLimit = (p) => (Number.isInteger(p?.perPersonLimit) && p.perPersonLimit > 0 ? p.perPersonLimit : 0);
// Ár forintban (null: nincs megadva)
export const productPrice = (p) => (Number.isInteger(p?.price) && p.price >= 0 ? p.price : null);
// "25 000 Ft" formátum (a szóköz nem törhető, így a szám nem esik szét két sorba)
export const formatPrice = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0Ft`;

// Egy vásárló egy termékből legfeljebb ennyit választhat: a limit, a maradék készlet és a technikai felső határ közül a legkisebb
export function maxSelectable(p, remaining) {
  let max = PREORDER_MAX_QTY;
  const limit = productLimit(p);
  if (limit) max = Math.min(max, limit);
  if (remaining !== null && remaining !== undefined) max = Math.min(max, remaining);
  return Math.max(0, max);
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

  // Elérhető mennyiség: nem kötelező (üres = nincs felső határ)
  const rawStock = input?.stock;
  let stock = null;
  if (rawStock !== null && rawStock !== undefined && String(rawStock).trim() !== '') {
    stock = Number(rawStock);
    if (!Number.isInteger(stock) || stock < 1 || stock > PRODUCT_STOCK_MAX) return { error: `Az elérhető mennyiség 1 és ${PRODUCT_STOCK_MAX} közötti egész szám lehet, vagy hagyd üresen.` };
  }
  // Személyenkénti limit: kötelező, 0 = korlátlan
  const rawLimit = input?.perPersonLimit;
  if (rawLimit === null || rawLimit === undefined || String(rawLimit).trim() === '') return { error: 'Add meg a személyenkénti limitet (0 = korlátlan).' };
  const perPersonLimit = Number(rawLimit);
  if (!Number.isInteger(perPersonLimit) || perPersonLimit < 0 || perPersonLimit > PRODUCT_LIMIT_MAX) return { error: `A személyenkénti limit 0 és ${PRODUCT_LIMIT_MAX} közötti egész szám lehet (0 = korlátlan).` };

  // Ár: nem kötelező (üres = nincs megadva), egész forint
  const rawPrice = input?.price;
  let price = null;
  if (rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== '') {
    price = Number(rawPrice);
    if (!Number.isInteger(price) || price < 0 || price > PRODUCT_PRICE_MAX) return { error: `Az ár 0 és ${PRODUCT_PRICE_MAX} Ft közötti egész szám lehet, vagy hagyd üresen.` };
  }

  return { product: { name, category, description, releaseDate, stock, perPersonLimit, price } };
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
