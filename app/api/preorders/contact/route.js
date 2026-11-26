import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { consumeRateLimit } from '@/lib/rateLimit';
import { isMailConfigured, sendMail } from '@/lib/mailer';
import { contactRecipient, sanitizeQuestion, questionMail } from '@/lib/contactMail';
import { toObjectId } from '@/lib/preorderData';

export const dynamic = 'force-dynamic';

// Kérdés az előrendelő oldalról: név, e-mail, üzenet (és ha egy termék oldaláról jön, a termék). A bolt postafiókjába
// megy, a válaszcím a kérdezőé (lib/contactMail.js). Nem mentjük el: a levél maga a nyilvántartás.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });
    if (body.website) return NextResponse.json({ success: true }); // robotcsapda

    const { question, error, field } = sanitizeQuestion(body);
    if (error) return NextResponse.json({ error, field }, { status: 400 });

    const to = contactRecipient();
    if (!isMailConfigured() || !to) return NextResponse.json({ error: 'Az üzenetküldés most nem elérhető. Kérjük, írj nekünk a bolt Facebook-oldalán.' }, { status: 503 });

    const db = await getTavernDb();
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const allowed = await consumeRateLimit(db, `contact-ip:${ip}`, 10, 60 * 60 * 1000)
      && await consumeRateLimit(db, `contact:${question.email}`, 5, 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Túl sok üzenet rövid idő alatt. Próbáld újra később.' }, { status: 429 });

    const oid = toObjectId(body.productId);
    const product = oid ? await db.collection('preorder_products').findOne({ _id: oid }, { projection: { name: 1 } }) : null;

    await sendMail({ to, ...questionMail({ ...question, product: product?.name || '' }) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('preorder contact error:', error);
    await logSystemError('preorder contact', error);
    return NextResponse.json({ error: 'Az üzenet most nem ment el. Próbáld újra később.' }, { status: 500 });
  }
}
