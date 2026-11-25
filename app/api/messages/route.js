import { NextResponse, after } from 'next/server';
import { ObjectId } from 'mongodb';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rateLimit';
import { cleanMessageText } from '@/lib/messageUtils';
import { canMessage } from '@/lib/permissions';
import { THREADS, messagingStatus, findRecipient, canSeeThread, publicThread, sendNewMessage, appendOutgoing } from '@/lib/messages';
import { syncMailbox } from '@/lib/mailboxSync';
import { appUrl } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// Szervezői üzenetek (lib/messages.js). GET: a látható szálak (a sajátjaim; a tulajdonosnak mind), a kiküldés állapota
// és az olvasatlan válaszok száma. POST: SEND (új üzenet), REPLY (válasz a szálban), READ (elolvastam),
// (A postafiókos módban a GET a háttérben a postafiókot is megnézi az új válaszokért: lib/mailboxSync.js.)
const bad = (error, status = 400) => NextResponse.json({ error }, { status });
const oid = (id) => (ObjectId.isValid(String(id || '')) && String(id).length === 24 ? new ObjectId(String(id)) : null);

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({ adminName: adminName || 'Rendszer', action, details, date: new Date() });
}

export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return bad('Jogosulatlan hozzáférés', 401);
    const db = await getTavernDb();
    after(() => syncMailbox(db, appUrl(request)).catch(() => {}));
    const query = session.role === 'owner' ? {} : { createdById: String(session.id) };
    const threads = await db.collection(THREADS).find(query).sort({ lastAt: -1 }).limit(300).toArray();
    return NextResponse.json({
      threads: threads.map(t => publicThread(t, session)),
      unread: threads.filter(t => t.unread && String(t.createdById) === String(session.id)).length,
      status: messagingStatus(),
    });
  } catch (error) {
    console.error('messages GET error:', error);
    await logSystemError('messages GET', error);
    return bad('Adatbázis hiba', 500);
  }
}

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return bad('Nincs jogosultságod a művelethez!', 401);
    const body = await request.json().catch(() => null);
    const { actionType, payload } = body || {};
    if (!payload || typeof payload !== 'object') return bad('Hiányzó adatok.');
    const db = await getTavernDb();
    const col = db.collection(THREADS);

    const loadThread = async () => {
      const id = oid(payload.threadId);
      const t = id ? await col.findOne({ _id: id }) : null;
      return t && canSeeThread(session, t) ? t : null;
    };

    if (actionType === 'SEND' || actionType === 'REPLY') {
      if (!canMessage(session)) return bad('Nincs jogosultságod üzenetet írni (Személyes adatok: 1. szint). A tulajdonos adhat hozzáférést.', 403);
      const { text, error } = cleanMessageText(payload.text);
      if (error) return bad(error);
      const subject = String(payload.subject ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
      if (!(await consumeRateLimit(db, `message:${session.id}`, 40, 60 * 60 * 1000))) return bad('Túl sok üzenet egy órán belül. Próbáld újra később.', 429);

      if (actionType === 'SEND') {
        const kind = payload.kind === 'preorder' ? 'preorder' : payload.kind === 'registration' ? 'registration' : null;
        if (!kind) return bad('Ismeretlen címzett.');
        const found = await findRecipient(db, session, kind, payload.refId);
        if (found.error) return bad(found.error, found.status);
        const res = await sendNewMessage(db, session, { kind, refId: payload.refId, subject, text, recipient: found.recipient });
        await addLog(db, session.username, 'ÜZENET', `${found.recipient.name} (${found.recipient.context}): ${res.status === 'sent' ? 'elküldve' : res.status === 'saved' ? 'elmentve (az e-mail küldés nincs beállítva)' : 'a küldés nem sikerült'}`);
        return NextResponse.json({ success: true, ...res });
      }

      const thread = await loadThread();
      if (!thread) return bad('A beszélgetés nem található.', 404);
      // A jog újraellenőrzése (ha közben elvették, a szervező már nem írhat)
      const found = await findRecipient(db, session, thread.kind, thread.refId);
      if (found.error && session.role !== 'owner') return bad(found.error, found.status);
      const last = [...(thread.messages || [])].reverse().find(m => m.dir === 'out');
      const res = await appendOutgoing(db, session, thread, { subject: subject || (last?.subject ? `Re: ${last.subject.replace(/^Re:\s*/i, '')}` : `Tavern: ${thread.context}`), text });
      await addLog(db, session.username, 'ÜZENET', `válasz: ${thread.toName} (${thread.context})`);
      return NextResponse.json({ success: true, ...res });
    }

    if (actionType === 'READ') {
      const thread = await loadThread();
      if (!thread) return bad('A beszélgetés nem található.', 404);
      // Olvasottnak csak az írója jelölheti (a tulajdonos nézelődése nem tünteti el a jelzést)
      if (String(thread.createdById) === String(session.id)) await col.updateOne({ _id: thread._id }, { $set: { unread: false } });
      return NextResponse.json({ success: true });
    }

    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('messages POST error:', error);
    await logSystemError('messages POST', error);
    return bad('Szerverhiba', 500);
  }
}
