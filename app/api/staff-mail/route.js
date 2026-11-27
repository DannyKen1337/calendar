import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { hasFeature } from '@/lib/permissions';
import { isMailConfigured, sendMail, appUrl } from '@/lib/mailer';
import { adminPath } from '@/lib/adminGate';
import { sanitizeArrival, arrivalMail } from '@/lib/arrivalMail';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Levél a szervezőknek (Továbbiak, a „Beérkezett levelek” joggal – a tulajdonosnak mindig): körlevél minden aktív
// szervezőnek és a tulajdonosnak (a küldőn kívül), mindenkinek külön levélben, a saját nevével ({név}); a küldő
// aláírásával és feladónevével, a válasz hozzá megy. Az előre megírt
// szöveg a mostani admin címmel (ADMIN_PATH) a szerverről jön, így a titkos cím nem kerül a kódba.
const displayName = (u) => String(u?.fullName || '').trim() || u?.username || '';

async function staff(db, ownerId) {
  const users = await db.collection('users').find({ role: { $in: ['admin', 'owner'] }, disabled: { $ne: true } }, { projection: { username: 1, fullName: 1, email: 1 } }).toArray();
  return users.filter(u => u.email && String(u._id) !== String(ownerId));
}

function draft(base, signer) {
  const gate = adminPath();
  const adminLink = `${base}${gate || '/admin'}`;
  return {
    subject: 'Új admin link, és él a tavern.hu',
    body: `Szia {név}!

Két fontos változás:

1. Az admin felület új címe: ${adminLink}
Ezt a linket nyisd meg egyszer, utána a megszokott módon be tudsz lépni. ${gate ? 'A régi /admin cím mostantól nem működik. ' : ''}Ha a telefonodon kezdőképernyős appként használod, nyisd meg egyszer az új linket, és ha kell, add hozzá újra a kezdőképernyőhöz. A linket kérlek, ne oszd meg nyilvánosan.

2. Él a weboldalunk: ${base}
A naptár: ${base}/naptar
Kérlek, reklámozzátok a közösségeitekben (Facebook-csoportok, Discord, a versenyek elején), és mostantól ezeket a linkeket osszátok meg.

Köszönöm!
${signer}
Tavern`,
  };
}

// a „Beérkezett levelek” jog (mailbox) kell hozzá; a tulajdonosnak mindig megvan
const allowed = async () => { const s = await verifyAdmin(); return s && hasFeature(s, 'mailbox') ? s : null; };
const DENIED = 'A szervezőknek szóló levélhez a „Beérkezett levelek” jog kell. A tulajdonos adhat hozzáférést.';

export async function GET(request) {
  const session = await allowed();
  if (!session) return NextResponse.json({ error: DENIED }, { status: 403 });
  const db = await getTavernDb();
  const list = await staff(db, session.id);
  const signer = session.displayName || session.username;
  return NextResponse.json({ recipients: list.map(u => ({ id: String(u._id), name: displayName(u) })), signer, canSend: isMailConfigured(), ...draft(appUrl(request), signer) });
}

export async function POST(request) {
  try {
    const session = await allowed();
    if (!session) return NextResponse.json({ error: DENIED }, { status: 403 });
    if (!isMailConfigured()) return NextResponse.json({ error: 'Az e-mail küldés nincs beállítva.' }, { status: 400 });
    const body = await request.json().catch(() => null);
    const mail = sanitizeArrival(body || {});
    if (mail.error) return NextResponse.json({ error: mail.error }, { status: 400 });
    const db = await getTavernDb();
    const list = await staff(db, session.id);
    if (!list.length) return NextResponse.json({ error: 'Nincs kinek kiküldeni (nincs másik szervező e-mail címmel).' }, { status: 400 });
    const signer = session.displayName || session.username;
    let sent = 0; const failed = [];
    for (const u of list) {
      try {
        // {név}: a szervező neve; a feladó a tulajdonos neve, a válasz a tulajdonoshoz megy
        await sendMail({ to: u.email, ...arrivalMail(mail, { name: displayName(u), quantity: '' }), fromName: `${signer} – Tavern`, ...(session.email && { replyTo: session.email }) });
        sent++;
      } catch (err) {
        failed.push(displayName(u));
        await logSystemError('levél a szervezőknek', err);
      }
    }
    await db.collection('audit_logs').insertOne({ adminName: session.username, action: 'KÖRLEVÉL', details: `Levél a szervezőknek: „${mail.subject}” – ${sent} kiment${failed.length ? `, ${failed.length} nem (${failed.join(', ')})` : ''}`, date: new Date() });
    return NextResponse.json({ success: true, sent, failed });
  } catch (error) {
    console.error('staff-mail error:', error);
    await logSystemError('staff-mail', error);
    return NextResponse.json({ error: 'A levél most nem ment ki.' }, { status: 500 });
  }
}
