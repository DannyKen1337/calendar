// Előrendelés: szerveroldali adatbetöltés (csak szerveren használható, adatbázist ér el)
import { ObjectId } from 'mongodb';
import { getTavernDb } from '@/lib/mongodb';
import { cachedPublic, TAG } from '@/lib/publicCache';
import { productStock, productLimit, productPrice, productStores } from '@/lib/preorders';

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
    price: productPrice(p),
    remaining: stock === null ? null : Math.max(0, stock - reserved),
    stock, // az elérhető mennyiség (a weboldal készletsávjához)
    stores: productStores(p), // hol vehető át (üres: minden boltban)
    buyNow: !!p.stripeUrl, // „Megveszem most” gomb (a Stripe linket csak a jelentkezés után kapja meg a vásárló)
  };
};

// A nyitott (előrendelhető) termékek a nyilvános oldalhoz, a legújabb elöl (gyorsítótárazva: lib/publicCache.js)
async function loadOpenPreorderProducts() {
  const db = await getTavernDb();
  const products = await db.collection('preorder_products').find({ isOpen: true }).sort({ createdAt: -1 }).toArray();
  const reserved = await reservedByProduct(db, products.map(p => String(p._id)));
  return products.map(p => publicProduct(p, reserved.get(String(p._id)) || 0));
}
export const getOpenPreorderProducts = cachedPublic(loadOpenPreorderProducts, 'elorendeles', [TAG.elorendeles]);
