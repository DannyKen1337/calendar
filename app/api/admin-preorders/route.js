import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory, hasFeature } from '@/lib/permissions';
import { sanitizeProductInput, productStock, PREORDER_GAMES } from '@/lib/preorders';
import { toObjectId } from '@/lib/preorderData';

export const dynamic = 'force-dynamic';

// Előrendelések kezelése az admin felületen. A szervező csak azoknak a játékoknak a termékeit
// és jelentkezőit látja és kezelheti, amelyeket kezelhet (az eseményekhez hasonlóan).

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({ adminName: adminName || 'Rendszer', action, details, date: new Date() });
}

export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    if (!hasFeature(session, 'preorders')) return NextResponse.json({ error: 'Nincs jogosultságod az előrendelésekhez. A tulajdonos adhat hozzáférést.' }, { status: 403 });

    const db = await getTavernDb();
    const products = (await db.collection('preorder_products').find({}).sort({ createdAt: -1 }).toArray())
      .filter(p => canManageCategory(session, p.category));
    const ids = products.map(p => String(p._id));
    const preorders = ids.length
      ? await db.collection('preorders').find({ productId: { $in: ids } }).sort({ date: 1 }).toArray()
      : [];

    return NextResponse.json({
      products: products.map(p => ({ id: String(p._id), name: p.name, category: p.category, description: p.description || '', releaseDate: p.releaseDate || '', stock: productStock(p), perPersonLimit: Number.isInteger(p.perPersonLimit) ? p.perPersonLimit : null, isOpen: !!p.isOpen, createdAt: p.createdAt, createdBy: p.createdBy || '' })),
      preorders: preorders.map(o => ({ id: String(o._id), productId: o.productId, name: o.name, email: o.email, phone: o.phone, quantity: o.quantity, date: o.date, updatedAt: o.updatedAt })),
      games: PREORDER_GAMES.filter(g => canManageCategory(session, g)),
    });
  } catch (error) {
    console.error('admin-preorders GET error:', error);
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Nincs jogosultságod a művelethez!' }, { status: 401 });
    if (!hasFeature(session, 'preorders')) return NextResponse.json({ error: 'Nincs jogosultságod az előrendelésekhez. A tulajdonos adhat hozzáférést.' }, { status: 403 });
    const body = await request.json().catch(() => null);
    const { actionType, payload } = body || {};
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });

    const db = await getTavernDb();
    const products = db.collection('preorder_products');
    const noPermission = () => NextResponse.json({ error: 'Ennek a játéknak a termékeit nem kezelheted.' }, { status: 403 });
    const findProduct = async (id) => { const oid = toObjectId(id); return oid ? products.findOne({ _id: oid }) : null; };

    // Új termék vagy meglévő szerkesztése
    if (actionType === 'SAVE_PRODUCT') {
      const { product, error } = sanitizeProductInput(payload);
      if (error) return NextResponse.json({ error }, { status: 400 });
      if (!canManageCategory(session, product.category)) return noPermission();

      if (payload.id) {
        const existing = await findProduct(payload.id);
        if (!existing) return NextResponse.json({ error: 'A termék nem található.' }, { status: 404 });
        if (!canManageCategory(session, existing.category)) return noPermission();
        await products.updateOne({ _id: existing._id }, { $set: { ...product, updatedAt: new Date() } });
        await addLog(db, session.username, 'ELŐRENDELÉS TERMÉK SZERKESZTÉSE', `${product.name} (${product.category})`);
        return NextResponse.json({ success: true, id: String(existing._id) });
      }

      const inserted = await products.insertOne({ ...product, isOpen: true, createdAt: new Date(), createdBy: session.username });
      await addLog(db, session.username, 'ELŐRENDELÉS TERMÉK', `Új termék: ${product.name} (${product.category})`);
      return NextResponse.json({ success: true, id: String(inserted.insertedId) });
    }

    // Előrendelés megnyitása / lezárása (lezárva nem jelenik meg a nyilvános oldalon, a jelentkezések megmaradnak)
    if (actionType === 'SET_PRODUCT_OPEN') {
      const existing = await findProduct(payload.id);
      if (!existing) return NextResponse.json({ error: 'A termék nem található.' }, { status: 404 });
      if (!canManageCategory(session, existing.category)) return noPermission();
      const isOpen = payload.isOpen === true;
      await products.updateOne({ _id: existing._id }, { $set: { isOpen, ...(isOpen ? {} : { closedAt: new Date() }) } });
      await addLog(db, session.username, 'ELŐRENDELÉS', `${isOpen ? 'Megnyitva' : 'Lezárva'}: ${existing.name}`);
      return NextResponse.json({ success: true });
    }

    // Termék törlése a hozzá tartozó összes jelentkezéssel együtt
    if (actionType === 'DELETE_PRODUCT') {
      const existing = await findProduct(payload.id);
      if (!existing) return NextResponse.json({ error: 'A termék nem található.' }, { status: 404 });
      if (!canManageCategory(session, existing.category)) return noPermission();
      const removed = await db.collection('preorders').deleteMany({ productId: String(existing._id) });
      await products.deleteOne({ _id: existing._id });
      await addLog(db, session.username, 'ELŐRENDELÉS TERMÉK TÖRLÉSE', `${existing.name} (${existing.category}), ${removed.deletedCount} jelentkezéssel`);
      return NextResponse.json({ success: true });
    }

    // Egy jelentkezés törlése
    if (actionType === 'DELETE_PREORDER') {
      const oid = toObjectId(payload.id);
      const order = oid ? await db.collection('preorders').findOne({ _id: oid }) : null;
      if (!order) return NextResponse.json({ error: 'A jelentkezés nem található.' }, { status: 404 });
      const product = await findProduct(order.productId);
      if (product && !canManageCategory(session, product.category)) return noPermission();
      if (!product && session.role !== 'owner') return noPermission();
      await db.collection('preorders').deleteOne({ _id: order._id });
      await addLog(db, session.username, 'ELŐRENDELÉS TÖRLÉSE', `${order.name} (${product?.name || 'törölt termék'})`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ismeretlen művelet.' }, { status: 400 });
  } catch (error) {
    console.error('admin-preorders POST error:', error);
    return NextResponse.json({ error: 'A művelet nem sikerült.' }, { status: 500 });
  }
}
