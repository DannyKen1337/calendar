// Előrendelés: szerveroldali adatbetöltés (csak szerveren használható, adatbázist ér el)
import { ObjectId } from 'mongodb';
import { getTavernDb } from '@/lib/mongodb';

export const toObjectId = (id) => {
  const s = String(id ?? '');
  return ObjectId.isValid(s) && s.length === 24 ? new ObjectId(s) : null;
};

// Nyilvános adatok egy termékről (a beküldött jelentkezések nélkül)
export const publicProduct = (p) => ({
  id: String(p._id),
  name: p.name,
  category: p.category,
  description: p.description || '',
  releaseDate: p.releaseDate || '',
});

// A nyitott (előrendelhető) termékek a nyilvános oldalhoz, a legújabb elöl
export async function getOpenPreorderProducts() {
  const db = await getTavernDb();
  const products = await db.collection('preorder_products').find({ isOpen: true }).sort({ createdAt: -1 }).toArray();
  return products.map(publicProduct);
}
