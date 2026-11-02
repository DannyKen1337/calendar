import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { consumeRateLimit } from '@/lib/rateLimit';
import { sanitizeTableRequest, tableBookingWhen } from '@/lib/tableBookings';
import { STORE_NAMES } from '@/lib/permissions';
import { isMailConfigured, sendMail, escapeHtml, mailLayout } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// Nyilvános asztalfoglalási kérés: függőben marad, amíg egy jogosult szervező el nem fogadja (lib/tableBookings.js)
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });

    // Rejtett mező: ember nem tölti ki, a robotok általában igen
    if (body.website) return NextResponse.json({ success: true });

    const { booking, error, field } = sanitizeTableRequest(body);
    if (error) return NextResponse.json({ error, field }, { status: 400 });

    const db = await getTavernDb();
    const settings = await db.collection('settings').findOne({ _id: 'global_settings' });
    if (settings?.isMaintenance) return NextResponse.json({ error: 'A foglalás átmenetileg nem elérhető. Kérjük, nézz vissza később!' }, { status: 503 });

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const allowed = await consumeRateLimit(db, `table-booking-ip:${ip}`, 20, 60 * 60 * 1000)
      && await consumeRateLimit(db, `table-booking:${booking.email}`, 5, 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Túl sok próbálkozás. Próbáld újra később.' }, { status: 429 });

    await db.collection('table_bookings').insertOne({ ...booking, status: 'pending', createdAt: new Date() });

    let mailSent = false;
    if (isMailConfigured()) {
      try {
        await sendMail({
          to: booking.email,
          subject: 'Megkaptuk az asztalfoglalási kérésedet – Tavern',
          html: mailLayout('Asztalfoglalási kérés', `
            <p>Kedves ${escapeHtml(booking.name)}!</p>
            <p>Megkaptuk a kérésedet: <b>${escapeHtml(STORE_NAMES[booking.store])}</b>, ${escapeHtml(tableBookingWhen(booking))}.</p>
            <p>A foglalás akkor él, ha visszaigazoljuk. Erről külön értesítünk.</p>
          `),
        });
        mailSent = true;
      } catch (mailErr) {
        console.error('table booking mail error:', mailErr);
        await logSystemError('table booking mail', mailErr);
      }
    }
    return NextResponse.json({ success: true, mailSent });
  } catch (error) {
    console.error('table booking error:', error);
    await logSystemError('table booking', error);
    return NextResponse.json({ error: 'A foglalás most nem sikerült. Próbáld újra később.' }, { status: 500 });
  }
}
