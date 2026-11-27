import { NextResponse, after } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { hasFeature } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rateLimit';
import { appUrl, isMailConfigured, sendMail } from '@/lib/mailer';
import { contactRecipient } from '@/lib/contactMail';
import { replyRecipient, buildReply, fromNameFor, REPLY_MAX } from '@/lib/inboxReply';
import { INBOX, syncMailbox, mailboxStatus } from '@/lib/mailboxSync';

export const dynamic = 'force-dynamic';

// Beérkezett levelek: a rendszer postafiókjába érkezett összes levél (lib/mailboxSync.js tölti).
// Csak a „Beérkezett levelek” joggal (és a tulajdonosnak). GET: a legutóbbi 200 levél fejadatai és egy rövid kivonat;
// ?id=<Message-ID>: egy levél teljes szövege. A háttérben megnézi a postafiókot az új levelekért (legfeljebb percenként).
export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    if (!hasFeature(session, 'mailbox')) return NextResponse.json({ error: 'Nincs jogosultságod a beérkezett levelekhez. A tulajdonos adhat hozzáférést.' }, { status: 403 });
    const db = await getTavernDb();
    const col = db.collection(INBOX);
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const m = await col.findOne({ _id: id });
      if (!m) return NextResponse.json({ error: 'A levél nem található.' }, { status: 404 });
      return NextResponse.json({ mail: { ...publicMail(m, true), replyTo: m.replyTo || null, replyToAddress: replyRecipient(m, ownAddresses())?.address || null, canSend: isMailConfigured(), replies: (m.replies || []).map(r => ({ at: r.at, by: r.byName || r.by, to: r.to, text: r.text })) } });
    }
    after(() => syncMailbox(db, appUrl(request), { minGapMs: 30000 }).catch(() => {}));
    const mails = await col.find({}, { projection: { text: { $substrCP: ['$text', 0, 160] }, from: 1, to: 1, subject: 1, date: 1, attachments: 1, tooBig: 1, threadId: 1, replies: { $size: { $ifNull: ['$replies', []] } } } }).sort({ date: -1 }).limit(200).toArray();
    return NextResponse.json({ mails: mails.map(m => publicMail(m, false)), status: await mailboxStatus(db), me: session.displayName || session.username });
  } catch (error) {
    console.error('inbox GET error:', error);
    await logSystemError('inbox GET', error);
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 });
  }
}

// A rendszer saját címei: ezekre nem megy válasz (pl. az előrendelő oldal kérdéseit a rendszer küldi magának, ott a Reply-To a kérdezőé)
const ownAddresses = () => [process.env.SMTP_USER, contactRecipient(), (String(process.env.MAIL_FROM || '').match(/<([^<>]+)>/) || [])[1] || process.env.MAIL_FROM];

// Válasz egy levélre: a rendszer postafiókjából, a belépett felhasználó aláírásával; a levélnél megjegyezzük (replies)
export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    if (!hasFeature(session, 'mailbox')) return NextResponse.json({ error: 'Nincs jogosultságod a beérkezett levelekhez. A tulajdonos adhat hozzáférést.' }, { status: 403 });
    const body = await request.json().catch(() => null);
    if (body?.actionType !== 'REPLY') return NextResponse.json({ error: 'Ismeretlen művelet.' }, { status: 400 });
    const text = String(body.text ?? '').replace(/\r\n?/g, '\n').trim();
    if (!text) return NextResponse.json({ error: 'Írd meg a választ.' }, { status: 400 });
    if (text.length > REPLY_MAX) return NextResponse.json({ error: `A válasz legfeljebb ${REPLY_MAX} karakter lehet.` }, { status: 400 });
    if (!isMailConfigured()) return NextResponse.json({ error: 'Az e-mail küldés nincs beállítva, ezért a válasz most nem küldhető el.' }, { status: 400 });

    const db = await getTavernDb();
    // közös keret az Üzenetekkel (lib/messages.js): óránként legfeljebb 40 kimenő levél felhasználónként
    if (!(await consumeRateLimit(db, `message:${session.id}`, 40, 60 * 60 * 1000))) return NextResponse.json({ error: 'Túl sok levél egy órán belül. Próbáld újra később.' }, { status: 429 });
    const col = db.collection(INBOX);
    const m = await col.findOne({ _id: String(body.id ?? '') });
    if (!m) return NextResponse.json({ error: 'A levél nem található.' }, { status: 404 });
    const to = replyRecipient(m, ownAddresses());
    if (!to) return NextResponse.json({ error: 'Erre a levélre nem lehet válaszolni (nincs külső feladója).' }, { status: 400 });

    const signer = session.displayName || session.username; // a teljes név, ha meg van adva
    const reply = buildReply({ text, username: signer, original: m });
    await sendMail({ to: to.address, subject: reply.subject, html: reply.html, text: reply.text, fromName: fromNameFor(signer), ...(m.messageId && { inReplyTo: m.messageId, references: m.messageId }) });
    const entry = { at: new Date(), by: session.username, byName: signer, to: to.address, text };
    await col.updateOne({ _id: m._id }, { $push: { replies: entry } });
    await db.collection('audit_logs').insertOne({ adminName: session.username, action: 'LEVÉL VÁLASZ', details: `Válasz: ${to.address} – ${reply.subject}`, date: new Date() });
    return NextResponse.json({ success: true, reply: { ...entry, by: signer } });
  } catch (error) {
    console.error('inbox POST error:', error);
    await logSystemError('inbox POST', error);
    return NextResponse.json({ error: 'A válasz most nem ment el. Próbáld újra később.' }, { status: 500 });
  }
}

const publicMail = (m, full) => ({
  id: m._id, from: m.from || {}, to: m.to || [], subject: m.subject || '', date: m.date,
  attachments: m.attachments || [], tooBig: !!m.tooBig, reply: !!m.threadId, ...(!full && { answered: (m.replies || 0) > 0 }),
  ...(full ? { text: m.text || '' } : { snippet: String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 140) }),
});
