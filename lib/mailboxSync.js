// A rendszer postafiókjának (IMAP, pl. Gmail) olvasása. Akkor él, ha a küldés SMTP-vel megy és van IMAP (lib/mailer.js
// imapConfig: Gmailnél magától imap.gmail.com, ugyanazzal az alkalmazásjelszóval), és nincs beállítva a Resend fogadó
// domainje (MAIL_REPLY_DOMAIN – akkor a webhook hozza a válaszokat).
// 1) Minden beérkezett levél bekerül az inbox_mails gyűjteménybe: ezt látja a „Beérkezett levelek” joggal rendelkező
//    (/admin/levelek, app/api/inbox). { _id: Message-ID, uid, from, to, subject, date, text, attachments, tooBig, threadId? }
// 2) A szervezői üzenetek „+” címére jött levél a szál válasza is: bekerül a szálba, olvasatlan lesz, az írója értesítést
//    kap (mint a Resend webhooknál) – ezt továbbra is csak a szál írója és a tulajdonos látja az Üzeneteknél.
// Nincs időzítve: az admin oldalak betöltésekor / frissítésekor fut a háttérben (after), legfeljebb percenként egyszer,
// zárolással (egyszerre csak egy).
import { ImapFlow } from 'imapflow';
import { imapConfig } from '@/lib/mailer';
import { readMailbox } from '@/lib/mailboxRead';
import { THREADS, appendIncoming, notifyWriter } from '@/lib/messages';
import { logSystemError } from '@/lib/systemLog';

export const INBOX = 'inbox_mails';
const STATE = 'mailbox_sync';

export const mailboxOn = () => !process.env.MAIL_REPLY_DOMAIN && !!imapConfig();

// A legutóbbi olvasás állapota (a Beérkezett levelek oldalnak): { on, at, error }
export async function mailboxStatus(db) {
  const st = await db.collection('settings').findOne({ _id: STATE });
  return { on: mailboxOn(), at: st?.at && st.at.getTime() > 0 ? st.at : null, error: st?.error || null };
}

// connect: a teszthez cserélhető (alapból ImapFlow a beállított postafiókkal)
export async function syncMailbox(db, appUrl, { minGapMs = 60000, connect = connectImap } = {}) {
  if (!mailboxOn()) return { skipped: 'nincs beállítva' };
  const settings = db.collection('settings');
  const now = new Date();
  await settings.updateOne({ _id: STATE }, { $setOnInsert: { at: new Date(0), lockUntil: new Date(0) } }, { upsert: true });
  const st = await settings.findOneAndUpdate(
    { _id: STATE, lockUntil: { $lt: now }, at: { $lt: new Date(now.getTime() - minGapMs) } },
    { $set: { lockUntil: new Date(now.getTime() + 90000) } },
  );
  if (!st) return { skipped: 'nemrég futott / épp fut' };

  let client = null;
  let stored = 0; let replies = 0;
  try {
    client = await connect();
    const { mails, state } = await readMailbox(client, st.imap || null);
    for (const m of mails) {
      const thread = m.token ? await db.collection(THREADS).findOne({ token: m.token }) : null;
      const { id, replyText, ...rest } = m;
      delete rest.token;
      const res = await db.collection(INBOX).updateOne({ _id: id }, { $setOnInsert: { ...rest, ...(thread && { threadId: String(thread._id) }), storedAt: new Date() } }, { upsert: true });
      if (res.upsertedCount) stored += 1;
      if (thread && await appendIncoming(db, thread, { text: replyText, emailId: id })) {
        replies += 1;
        await notifyWriter(db, thread, appUrl);
      }
    }
    await settings.updateOne({ _id: STATE }, { $set: { at: now, lockUntil: new Date(0), imap: state, error: null } });
    return { stored, replies };
  } catch (error) {
    const msg = String(error?.responseText || error?.message || error).slice(0, 300);
    await settings.updateOne({ _id: STATE }, { $set: { at: now, lockUntil: new Date(0), error: msg } });
    await logSystemError('postafiók olvasása', error);
    return { error: msg };
  } finally {
    if (client) await client.logout().catch(() => {});
  }
}

async function connectImap() {
  const cfg = imapConfig();
  const client = new ImapFlow({
    host: cfg.host, port: cfg.port, secure: cfg.port === 993, auth: { user: cfg.user, pass: cfg.pass },
    logger: false, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
  });
  client.on('error', () => {}); // a hibát a connect / a parancsok dobják; ez csak a kezeletlen esemény ellen van
  await client.connect();
  return client;
}
