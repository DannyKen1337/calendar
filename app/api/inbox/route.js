import { NextResponse, after } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { hasFeature } from '@/lib/permissions';
import { appUrl } from '@/lib/mailer';
import { INBOX, syncMailbox, mailboxStatus } from '@/lib/mailboxSync';

export const dynamic = 'force-dynamic';

// Beérkezett levelek (csak olvasás): a rendszer postafiókjába érkezett összes levél (lib/mailboxSync.js tölti).
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
      return NextResponse.json({ mail: publicMail(m, true) });
    }
    after(() => syncMailbox(db, appUrl(request), { minGapMs: 30000 }).catch(() => {}));
    const mails = await col.find({}, { projection: { text: { $substrCP: ['$text', 0, 160] }, from: 1, to: 1, subject: 1, date: 1, attachments: 1, tooBig: 1, threadId: 1 } }).sort({ date: -1 }).limit(200).toArray();
    return NextResponse.json({ mails: mails.map(m => publicMail(m, false)), status: await mailboxStatus(db) });
  } catch (error) {
    console.error('inbox GET error:', error);
    await logSystemError('inbox GET', error);
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 });
  }
}

const publicMail = (m, full) => ({
  id: m._id, from: m.from || {}, to: m.to || [], subject: m.subject || '', date: m.date,
  attachments: m.attachments || [], tooBig: !!m.tooBig, reply: !!m.threadId,
  ...(full ? { text: m.text || '' } : { snippet: String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 140) }),
});
