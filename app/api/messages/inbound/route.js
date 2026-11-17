import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { appUrl } from '@/lib/mailer';
import { verifySvix, replyTokenFrom, stripQuoted, htmlToText } from '@/lib/messageUtils';
import { THREADS, appendIncoming, notifyWriter } from '@/lib/messages';

export const dynamic = 'force-dynamic';

// A szervezői üzenetekre érkező válaszok: a Resend „email.received” webhookja (Resend → Webhooks, a cím:
// <APP_URL>/api/messages/inbound, a titok: RESEND_WEBHOOK_SECRET). A webhook csak a fejadatokat küldi, a levél
// szövegét a Resend API-ból kérjük le (GET /emails/receiving/{id}). A címzett címéből (valasz-<token>@...) derül ki a szál.
// A feladó címe nem kerül a felületre; a választ csak a szál írója és a tulajdonos látja.
export async function POST(request) {
  const raw = await request.text();
  const ok = verifySvix(process.env.RESEND_WEBHOOK_SECRET, {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  }, raw);
  if (!ok) return NextResponse.json({ error: 'Hibás aláírás' }, { status: 401 });

  try {
    const event = JSON.parse(raw);
    if (event?.type !== 'email.received') return NextResponse.json({ ignored: true });
    const data = event.data || {};
    const token = replyTokenFrom([...(data.to || []), ...(data.cc || []), ...(data.received_for || [])]);
    if (!token) return NextResponse.json({ ignored: 'nincs szál' });

    const db = await getTavernDb();
    const thread = await db.collection(THREADS).findOne({ token });
    if (!thread) return NextResponse.json({ ignored: 'ismeretlen szál' });

    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(data.email_id)}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) throw new Error(`a beérkezett levél lekérése sikertelen (${res.status})`);
    const mail = await res.json();
    const text = stripQuoted(mail.text || htmlToText(mail.html)) || '(üres válasz)';

    const added = await appendIncoming(db, thread, { text, emailId: String(data.email_id) });
    if (added) await notifyWriter(db, thread, appUrl(request));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('messages inbound error:', error);
    await logSystemError('messages inbound', error);
    // 500: a Resend később újra próbálja
    return NextResponse.json({ error: 'Szerverhiba' }, { status: 500 });
  }
}
