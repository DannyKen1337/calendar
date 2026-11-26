import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory, hasFeature, seesPersonalData, canMessage } from '@/lib/permissions';
import { sanitizeProductInput, productStock, productPrice, productStores, PREORDER_GAMES } from '@/lib/preorders';
import { toObjectId } from '@/lib/preorderData';
import { messagingStatus } from '@/lib/messages';
import { isMailConfigured, sendMail } from '@/lib/mailer';
import { sanitizeArrival, arrivalMail, arrivalRecipients } from '@/lib/arrivalMail';

export const dynamic = 'force-dynamic';
// A „Megérkezett” értesítő sok levelet küldhet egyszerre
export const maxDuration = 300;

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
      products: products.map(p => ({ id: String(p._id), name: p.name, category: p.category, description: p.description || '', releaseDate: p.releaseDate || '', stock: productStock(p), price: productPrice(p), stripeUrl: p.stripeUrl || '', stores: productStores(p), perPersonLimit: Number.isInteger(p.perPersonLimit) ? p.perPersonLimit : null, isOpen: !!p.isOpen, arrivalNotice: p.arrivalNotice || null, createdAt: p.createdAt, createdBy: p.createdBy || '' })),
      // 1. szint: e-mail és telefon nélkül (a rendszeren keresztül írhat nekik: hasEmail); 2. szint: minden adat
      messaging: { personalData: seesPersonalData(session), canMessage: canMessage(session), ...messagingStatus() },
      preorders: preorders.map(o => ({ id: String(o._id), productId: o.productId, name: o.name, ...(seesPersonalData(session) ? { email: o.email, phone: o.phone } : { hasEmail: !!o.email }), quantity: o.quantity, date: o.date, updatedAt: o.updatedAt, checkoutAt: o.checkoutAt || null, arrivalMailAt: o.arrivalMailAt || null, handedOverAt: o.handedOverAt || null, handedOverBy: o.handedOverBy || '', paidAt: o.paidAt || null, paidBy: o.paidBy || '' })),
      games: PREORDER_GAMES.filter(g => canManageCategory(session, g)),
    });
  } catch (error) {
    console.error('admin-preorders GET error:', error);
    await logSystemError('admin-preorders GET', error);
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
        const stripeNote = (existing.stripeUrl || null) === product.stripeUrl ? '' : product.stripeUrl ? (existing.stripeUrl ? ', Stripe link módosítva' : ', Stripe link hozzáadva') : ', Stripe link törölve';
        await addLog(db, session.username, 'ELŐRENDELÉS TERMÉK SZERKESZTÉSE', `${product.name} (${product.category})${stripeNote}`);
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

    // Átadás jelölése / visszavonása (az admin listában az átadottak a lista aljára kerülnek, az Excelben is látszik)
    if (actionType === 'SET_PREORDER_HANDED_OVER') {
      const oid = toObjectId(payload.id);
      const order = oid ? await db.collection('preorders').findOne({ _id: oid }) : null;
      if (!order) return NextResponse.json({ error: 'A jelentkezés nem található.' }, { status: 404 });
      const product = await findProduct(order.productId);
      if (product && !canManageCategory(session, product.category)) return noPermission();
      if (!product && session.role !== 'owner') return noPermission();
      const handedOver = payload.handedOver === true;
      await db.collection('preorders').updateOne({ _id: order._id }, handedOver
        ? { $set: { handedOverAt: new Date(), handedOverBy: session.username } }
        : { $unset: { handedOverAt: '', handedOverBy: '' } });
      await addLog(db, session.username, 'ELŐRENDELÉS ÁTADÁS', `${handedOver ? 'Átadva' : 'Átadás visszavonva'}: ${order.name} – ${product?.name || 'törölt termék'} (${order.quantity} db)`);
      return NextResponse.json({ success: true });
    }

    // Fizetés jelölése / visszavonása (az átadáshoz hasonlóan, időponttal és a rögzítő nevével)
    if (actionType === 'SET_PREORDER_PAID') {
      const oid = toObjectId(payload.id);
      const order = oid ? await db.collection('preorders').findOne({ _id: oid }) : null;
      if (!order) return NextResponse.json({ error: 'A jelentkezés nem található.' }, { status: 404 });
      const product = await findProduct(order.productId);
      if (product && !canManageCategory(session, product.category)) return noPermission();
      if (!product && session.role !== 'owner') return noPermission();
      const paid = payload.paid === true;
      await db.collection('preorders').updateOne({ _id: order._id }, paid
        ? { $set: { paidAt: new Date(), paidBy: session.username } }
        : { $unset: { paidAt: '', paidBy: '' } });
      await addLog(db, session.username, 'ELŐRENDELÉS FIZETÉS', `${paid ? 'Fizetve' : 'Fizetés visszavonva'}: ${order.name} – ${product?.name || 'törölt termék'} (${order.quantity} db)`);
      return NextResponse.json({ success: true });
    }

    // „Megérkezett” értesítő: a szervező által (az előnézetben) jóváhagyott tárgy és szöveg, vásárlónként külön levélben
    // (a címek nem látják egymást). Akinek kiment, annál arrivalMailAt jelzi: így egy félbeszakadt küldés folytatható.
    if (actionType === 'SEND_ARRIVAL_NOTICE') {
      const existing = await findProduct(payload.productId);
      if (!existing) return NextResponse.json({ error: 'A termék nem található.' }, { status: 404 });
      if (!canManageCategory(session, existing.category)) return noPermission();
      if (!canMessage(session)) return NextResponse.json({ error: 'Az értesítés kiküldéséhez a „Személyes adatok: 1. szint” jog kell. A tulajdonos adhat hozzáférést.' }, { status: 403 });
      if (!isMailConfigured()) return NextResponse.json({ error: 'Az e-mail küldés nincs beállítva, ezért a levél most nem küldhető ki.' }, { status: 400 });
      const mail = sanitizeArrival(payload);
      if (mail.error) return NextResponse.json({ error: mail.error }, { status: 400 });
      const orders = await db.collection('preorders').find({ productId: String(existing._id) }).sort({ date: 1 }).toArray();
      const recipients = arrivalRecipients(orders, { skipHanded: payload.skipHanded !== false, skipNotified: payload.skipNotified !== false });
      if (!recipients.length) return NextResponse.json({ error: 'Nincs kinek kiküldeni (mindenki megkapta már, vagy átvette).' }, { status: 400 });

      let sent = 0;
      const failed = [];
      for (let i = 0; i < recipients.length; i += 3) {
        await Promise.all(recipients.slice(i, i + 3).map(async (o) => {
          try {
            await sendMail({ to: o.email, ...arrivalMail(mail, { name: o.name, quantity: o.quantity }) });
            await db.collection('preorders').updateOne({ _id: o._id }, { $set: { arrivalMailAt: new Date() } });
            sent++;
          } catch (err) {
            failed.push(o.name);
            await logSystemError('arrival mail', err);
          }
        }));
      }
      if (sent) await products.updateOne({ _id: existing._id }, { $set: { arrivalNotice: { at: new Date(), by: session.username, count: sent + (existing.arrivalNotice?.count || 0) } } });
      await addLog(db, session.username, 'ELŐRENDELÉS ÉRTESÍTÉS', `Megérkezett: ${existing.name} – ${sent} levél kiment${failed.length ? `, ${failed.length} nem (${failed.join(', ')})` : ''}`);
      return NextResponse.json({ success: true, sent, failed });
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
    await logSystemError('admin-preorders POST', error);
    return NextResponse.json({ error: 'A művelet nem sikerült.' }, { status: 500 });
  }
}
