// Előrendelés: szerveroldali adatbetöltés (csak szerveren használható, adatbázist ér el)
import { ObjectId } from 'mongodb';
import { getTavernDb } from '@/lib/mongodb';
import { productStock, productLimit } from '@/lib/preorders';

export const toObjectId = (id) => {
  const s = String(id ?? '');
  return ObjectId.isValid(s) && s.length === 24 ? new ObjectId(s) : null;
};

// Termékenként az eddig előrendelt darabszám (productId => db)
export async function reservedByProduct(db, productIds) {
  if (!productIds.length) return new Map();
  const rows = await db.collection('preorders').aggregate([
    { $match: { productId: { $in: productIds } } },
    { $group: { _id: '$productId', total: { $sum: '$quantity' } } },
  ]).toArray();
  return new Map(rows.map(r => [r._id, r.total]));
}

// Nyilvános adatok egy termékről (a beküldött jelentkezések nélkül).
// remaining: még foglalható darab (null, ha nincs megadva elérhető mennyiség); perPersonLimit: 0 = korlátlan
export const publicProduct = (p, reserved = 0) => {
  const stock = productStock(p);
  return {
    id: String(p._id),
    name: p.name,
    category: p.category,
    description: p.description || '',
    releaseDate: p.releaseDate || '',
    perPersonLimit: productLimit(p),
    remaining: stock === null ? null : Math.max(0, stock - reserved),
  };
};

// A nyitott (előrendelhető) termékek a nyilvános oldalhoz, a legújabb elöl
export async function getOpenPreorderProducts() {
  const db = await getTavernDb();
  const products = await db.collection('preorder_products').find({ isOpen: true }).sort({ createdAt: -1 }).toArray();
  const reserved = await reservedByProduct(db, products.map(p => String(p._id)));
  return products.map(p => publicProduct(p, reserved.get(String(p._id)) || 0));
}
