import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { appUrl } from '@/lib/mailer';
import { SUBS, vapidKeys, subscribe, unsubscribe, pushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Telefonos értesítések feliratkozása (lib/push.js). GET: a nyilvános kulcs és hogy ez az eszköz (?endpoint=) fel van-e
// iratkozva. POST: SUBSCRIBE { subscription } (utána egy „Bekapcsolva” értesítés megy erre az eszközre, hogy látszódjon,
// működik), UNSUBSCRIBE { endpoint }. Mindenki csak a saját eszközeit kezeli.
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return bad('Jogosulatlan hozzáférés', 401);
    const db = await getTavernDb();
    const { publicKey } = await vapidKeys(db);
    const endpoint = new URL(request.url).searchParams.get('endpoint');
    const subscribed = endpoint ? !!(await db.collection(SUBS).findOne({ _id: endpoint, userId: String(session.id) })) : false;
    const devices = await db.collection(SUBS).countDocuments({ userId: String(session.id) });
    return NextResponse.json({ publicKey, subscribed, devices });
  } catch (error) {
    console.error('push GET error:', error);
    await logSystemError('push GET', error);
    return bad('Adatbázis hiba', 500);
  }
}

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return bad('Jogosulatlan hozzáférés', 401);
    const { actionType, payload } = (await request.json().catch(() => null)) || {};
    const db = await getTavernDb();
    if (actionType === 'SUBSCRIBE') {
      const res = await subscribe(db, session.id, payload?.subscription, request.headers.get('user-agent') || '');
      if (res.error) return bad(res.error);
      const base = appUrl(request);
      await pushToUser(db, session.id, { title: 'Értesítések bekapcsolva', body: 'Ezen az eszközön szólunk, ha valaki válaszol az üzenetedre.', url: '/admin?lap=tovabbiak', tag: 'push-be' }, { subject: base })
        .catch(() => {});
      return NextResponse.json({ success: true });
    }
    if (actionType === 'UNSUBSCRIBE') {
      await unsubscribe(db, session.id, payload?.endpoint);
      return NextResponse.json({ success: true });
    }
    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('push POST error:', error);
    await logSystemError('push POST', error);
    return bad('Szerverhiba', 500);
  }
}
