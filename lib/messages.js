// Szervezői üzenetek a jelentkezőknek és az előrendelőknek, a rendszeren keresztül (1. szinten a szervező nem látja a
// címzett e-mail címét). Egy szál (message_threads) = egy szervező és egy jelentkezés / előrendelés levelezése:
//   { kind: 'registration' | 'preorder', refId, context, toName, toEmail, createdById, createdBy, createdAt, lastAt,
//     token, unread, messages: [{ id, dir: 'out' | 'in', text, subject?, at, by?, status?, emailId?, test? }] }
// A szálat csak az írója és a tulajdonos látja. A kimenő levél válaszcíme a szál saját fogadó címe
// (valasz-<token>@MAIL_REPLY_DOMAIN); a válasz a Resend webhookján érkezik vissza (app/api/messages/inbound). Postafiókos
// módban (SMTP + IMAP, pl. Gmail) a postafiók „+” címe (…+valasz-<token>@gmail.com), és lib/mailboxSync.js olvassa vissza.
// Beállítás nélkül (RESEND_API_KEY, MAIL_FROM) az üzenet csak a rendszerben mentődik el (teszt mód).
import { ObjectId } from 'mongodb';
import { canManageEvent, canManageCategory, hasFeature } from '@/lib/permissions';
import { isMailConfigured, sendMail, mailLayout, escapeHtml, imapConfig } from '@/lib/mailer';
import { newReplyToken, replyAddress, plusReplyAddress } from '@/lib/messageUtils';
import { pushToUser } from '@/lib/push';

export const THREADS = 'message_threads';
const oid = (id) => (ObjectId.isValid(String(id || '')) && String(id).length === 24 ? new ObjectId(String(id)) : null);

// A szál válaszcíme: a Resend fogadó domainje, vagy postafiókos módban a postafiók „+” címe; null, ha nem fogadunk választ
const replyToFor = (token) => (process.env.MAIL_REPLY_DOMAIN ? replyAddress(token, process.env.MAIL_REPLY_DOMAIN)
  : imapConfig() ? plusReplyAddress(token, process.env.SMTP_USER) : null);

// Mi működik: a kiküldés (Resend / SMTP) és a válaszok fogadása (fogadó domain + webhook titok, vagy a postafiók olvasása)
export const messagingStatus = () => ({
  send: isMailConfigured(),
  replies: isMailConfigured() && ((!!process.env.MAIL_REPLY_DOMAIN && !!process.env.RESEND_WEBHOOK_SECRET) || (!process.env.MAIL_REPLY_DOMAIN && !!imapConfig())),
});

const huDate = (d) => (d ? new Date(d).toLocaleDateString('hu-HU', { timeZone: 'Europe/Budapest', month: 'long', day: 'numeric' }) : '');

// A címzett megkeresése és a jog ellenőrzése: { recipient: { email, name, context } } vagy { error, status }
export async function findRecipient(db, session, kind, refId) {
  const id = oid(refId);
  if (!id) return { error: 'A címzett nem található.', status: 404 };
  if (kind === 'registration') {
    const reg = await db.collection('registrations').findOne({ _id: id });
    if (!reg) return { error: 'A jelentkezés nem található.', status: 404 };
    const tid = oid(reg.tournamentId);
    const event = tid ? await db.collection('tournaments').findOne({ _id: tid }) : null;
    if (!event || !canManageEvent(session, event)) return { error: 'Ennek az eseménynek a jelentkezőit nem kezelheted.', status: 403 };
    if (!reg.email) return { error: 'Ennek a jelentkezőnek nincs e-mail címe.', status: 400 };
    const name = [reg.username, reg.name && reg.name !== reg.username ? reg.name : null].filter(Boolean).join(' · ');
    return { recipient: { email: reg.email, name: name || 'Jelentkező', context: `${event.name}${event.date ? ` (${huDate(event.date)})` : ''}` } };
  }
  if (kind === 'preorder') {
    if (!hasFeature(session, 'preorders')) return { error: 'Nincs jogosultságod az előrendelésekhez.', status: 403 };
    const order = await db.collection('preorders').findOne({ _id: id });
    if (!order) return { error: 'Az előrendelés nem található.', status: 404 };
    const pid = oid(order.productId);
    const product = pid ? await db.collection('preorder_products').findOne({ _id: pid }) : null;
    if (!product || !canManageCategory(session, product.category)) return { error: 'Ennek a játéknak az előrendeléseit nem kezelheted.', status: 403 };
    if (!order.email) return { error: 'Ennek az előrendelőnek nincs e-mail címe.', status: 400 };
    return { recipient: { email: order.email, name: order.name || 'Előrendelő', context: `Előrendelés: ${product.name}` } };
  }
  return { error: 'Ismeretlen címzett.', status: 400 };
}

// A szál látható-e a felhasználónak: az írója és a tulajdonos
export const canSeeThread = (session, t) => session.role === 'owner' || String(t.createdById) === String(session.id);

// A szál a böngészőnek: e-mail cím, token és a beérkező levél feladója nélkül
export function publicThread(t, session) {
  return {
    id: String(t._id), kind: t.kind, refId: t.refId, context: t.context, toName: t.toName,
    createdBy: t.createdBy, mine: String(t.createdById) === String(session.id), createdAt: t.createdAt, lastAt: t.lastAt,
    unread: !!t.unread,
    messages: (t.messages || []).map(m => ({ id: m.id, dir: m.dir, text: m.text, subject: m.subject || '', at: m.at, by: m.byName || m.by || '', status: m.status || '', test: !!m.test })),
  };
}

// Egy kimenő levél elküldése a szál címzettjének. Visszaad: 'sent' | 'saved' (nincs beállítva a küldés) | 'failed'
async function deliver(thread, { subject, text, fromName }) {
  if (!isMailConfigured()) return 'saved';
  const replyTo = replyToFor(thread.token);
  const body = `<p style="white-space:pre-line;line-height:1.5">${escapeHtml(text)}</p>
    <p style="color:#9a8a8c;font-size:13px;margin-top:24px">${escapeHtml(fromName)} írt neked a Tavern szervezői felületéről (${escapeHtml(thread.context)}).${replyTo ? ' Ha válaszolsz erre a levélre, a válaszod hozzá érkezik.' : ''}</p>`;
  try {
    await sendMail({
      to: thread.toEmail, subject, html: mailLayout(subject, body), fromName: `${fromName} – Tavern`,
      text: `${text}\n\n—\n${fromName} írt neked a Tavern szervezői felületéről (${thread.context}).`,
      ...(replyTo && { replyTo }),
    });
    return 'sent';
  } catch (err) {
    console.error('üzenet küldése:', err);
    return 'failed';
  }
}

// Új üzenet egy jelentkezőnek / előrendelőnek (ha ugyanennek a címzettnek már írt, ugyanabba a szálba kerül)
export async function sendNewMessage(db, session, { kind, refId, subject, text, recipient }) {
  const col = db.collection(THREADS);
  let thread = await col.findOne({ kind, refId: String(refId), createdById: String(session.id) });
  const now = new Date();
  if (!thread) {
    thread = { kind, refId: String(refId), context: recipient.context, toName: recipient.name, toEmail: recipient.email, createdById: String(session.id), createdBy: session.username, createdAt: now, lastAt: now, token: newReplyToken(), unread: false, messages: [] };
    const ins = await col.insertOne(thread);
    thread._id = ins.insertedId;
  }
  return appendOutgoing(db, session, thread, { subject: subject || `Tavern: ${recipient.context}`, text });
}

// Válasz egy meglévő szálban (ugyanannak a címzettnek)
export async function appendOutgoing(db, session, thread, { subject, text }) {
  // a levélben és a felületen a teljes név látszik, ha meg van adva (lib/displayName.js); a by a felhasználónév marad
  const name = session.displayName || session.username;
  const status = await deliver(thread, { subject, text, fromName: name });
  const msg = { id: newReplyToken(), dir: 'out', text, subject, at: new Date(), by: session.username, byName: name, status };
  await db.collection(THREADS).updateOne({ _id: thread._id }, { $push: { messages: msg }, $set: { lastAt: msg.at } });
  return { status, threadId: String(thread._id) };
}

// Beérkező válasz a szálba (a webhookból vagy a postafiókból). Ugyanaz a levél (emailId) csak egyszer kerül be.
export async function appendIncoming(db, thread, { text, emailId = null, test = false }) {
  const msg = { id: newReplyToken(), dir: 'in', text, at: new Date(), ...(emailId && { emailId }), ...(test && { test: true }) };
  const filter = emailId ? { _id: thread._id, 'messages.emailId': { $ne: emailId } } : { _id: thread._id };
  const res = await db.collection(THREADS).updateOne(filter, { $push: { messages: msg }, $set: { lastAt: msg.at, unread: true } });
  return res.modifiedCount > 0;
}

// Értesítés a szál írójának, hogy válasz érkezett: telefonos értesítés (ha feliratkozott, lib/push.js) és e-mail
// (ha az e-mail küldés be van állítva). A válasz szövege egyikben sincs benne, csak a neve és a link.
export async function notifyWriter(db, thread, appUrl) {
  const link = `${appUrl}/admin/uzenetek?szal=${thread._id}`;
  await pushToUser(db, thread.createdById, { title: 'Válasz érkezett', body: `${thread.toName} válaszolt (${thread.context})`, url: `/admin/uzenetek?szal=${thread._id}`, tag: `szal-${thread._id}` }, { subject: appUrl })
    .catch(err => console.error('válasz push:', err));
  if (!isMailConfigured()) return;
  const writer = oid(thread.createdById) ? await db.collection('users').findOne({ _id: oid(thread.createdById) }, { projection: { email: 1 } }) : null;
  if (!writer?.email) return;
  await sendMail({
    to: writer.email,
    subject: `Válasz érkezett: ${thread.toName}`,
    html: mailLayout('Válasz érkezett', `<p>${escapeHtml(thread.toName)} válaszolt az üzenetedre (${escapeHtml(thread.context)}).</p><p><a href="${escapeHtml(link)}" style="color:#E5B15D">Megnézem az Üzenetek között</a></p>`),
  }).catch(err => console.error('válasz értesítés:', err));
}
