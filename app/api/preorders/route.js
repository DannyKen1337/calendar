import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { consumeRateLimit, isValidEmail } from '@/lib/rateLimit';
import { normalizePhone, normalizeQuantity, PREORDER_MAX_ITEMS } from '@/lib/preorders';
import { toObjectId } from '@/lib/preorderData';
import { isMailConfigured, sendMail, escapeHtml, mailLayout } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// Nyilvános előrendelés (feliratkozás) beküldése: név, e-mail, telefon és a kiválasztott termékek darabszámmal.
// Ugyanarra a termékre egy e-mail címmel egy sor tartozik: újraküldéskor a meglévő sor frissül (pl. más darabszám).
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });

    // Rejtett mező: ember nem tölti ki, a robotok általában igen
    if (body.website) return NextResponse.json({ success: true, count: 0, updated: 0 });

    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = normalizePhone(body.phone);
    if (!name || name.length > 120) return NextResponse.json({ error: 'Add meg a teljes neved.', field: 'name' }, { status: 400 });
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Érvényes e-mail címet adj meg.', field: 'email' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'Érvényes telefonszámot adj meg (pl. +36 30 123 4567).', field: 'phone' }, { status: 400 });

    const rawItems = Array.isArray(body.items) ? body.items.slice(0, PREORDER_MAX_ITEMS) : [];
    const items = new Map(); // productId => darab
    for (const item of rawItems) {
      const oid = toObjectId(item?.productId);
      const qty = normalizeQuantity(item?.quantity);
      if (!oid || !qty) return NextResponse.json({ error: 'Hibás termék vagy darabszám.' }, { status: 400 });
      items.set(String(oid), qty);
    }
    if (items.size === 0) return NextResponse.json({ error: 'Válassz legalább egy terméket.', field: 'items' }, { status: 400 });

    const db = await getTavernDb();

    const settings = await db.collection('settings').findOne({ _id: 'global_settings' });
    if (settings?.isMaintenance) return NextResponse.json({ error: 'Az előrendelés átmenetileg nem elérhető. Kérjük, nézz vissza később!' }, { status: 503 });

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const allowed = await consumeRateLimit(db, `preorder-ip:${ip}`, 40, 60 * 60 * 1000)
      && await consumeRateLimit(db, `preorder:${email}`, 10, 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Túl sok próbálkozás. Próbáld újra később.' }, { status: 429 });

    const products = await db.collection('preorder_products')
      .find({ _id: { $in: [...items.keys()].map(id => toObjectId(id)) }, isOpen: true })
      .toArray();
    if (products.length !== items.size) {
      return NextResponse.json({ error: 'Valamelyik kiválasztott termék előrendelése közben lezárult. Frissítsd az oldalt, és próbáld újra.' }, { status: 409 });
    }

    const now = new Date();
    let updated = 0;
    for (const p of products) {
      const upsert = () => db.collection('preorders').updateOne(
        { productId: String(p._id), email },
        { $set: { name, phone, quantity: items.get(String(p._id)), updatedAt: now }, $setOnInsert: { productId: String(p._id), email, date: now } },
        { upsert: true }
      );
      // Két párhuzamos beküldésnél (dupla kattintás) az egyedi index miatt az egyik upsert ütközhet: ilyenkor még egyszer próbáljuk, akkor már frissít
      const res = await upsert().catch(err => (err?.code === 11000 ? upsert() : Promise.reject(err)));
      if (res.matchedCount > 0) updated++;
    }

    let mailSent = false;
    if (isMailConfigured()) {
      try {
        const list = products.map(p => `<li><b>${escapeHtml(p.name)}</b> (${escapeHtml(p.category)}) – ${items.get(String(p._id))} db</li>`).join('');
        await sendMail({
          to: email,
          subject: 'Előrendelésed visszaigazolása – Tavern',
          html: mailLayout('Előrendelés visszaigazolása', `
            <p>Kedves ${escapeHtml(name)}!</p>
            <p>Megkaptuk az előrendelésedet az alábbi termékekre:</p>
            <ul>${list}</ul>
            <p>Amikor a termék megérkezik, a megadott elérhetőségeiden keresünk.</p>
          `),
        });
        mailSent = true;
      } catch (mailErr) {
        console.error('preorder mail error:', mailErr);
      }
    }

    return NextResponse.json({ success: true, count: products.length, updated, mailSent });
  } catch (error) {
    console.error('preorder error:', error);
    return NextResponse.json({ error: 'Az előrendelés most nem sikerült. Próbáld újra később.' }, { status: 500 });
  }
}
