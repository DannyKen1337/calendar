// A rendszer postafiókjába érkezett levelek kiolvasása (IMAP; lib/mailboxSync.js hívja). Tiszta rész, külön tesztelhető
// (lib/mailboxRead.test.mjs, ál-IMAP klienssel): csak a megnyitott kapcsolatot kapja.
// Mindig csak az előző olvasás óta érkezett leveleket nézi (UID alapján); az első olvasás (vagy ha a postafiók
// UID-sorozata megváltozik) az utolsó 14 nap leveleit. A levelekhez nem nyúl (nem jelöli olvasottnak, nem mozgatja).
// Ha a levél egy szervezői üzenet szálának „+” címére jött (…+valasz-<token>@gmail.com), az a szál válasza (token).
import { simpleParser } from 'mailparser';
import { replyTokenFrom, stripQuoted, htmlToText } from './messageUtils.js';

const MAX_SOURCE = 8 * 1024 * 1024; // ennél nagyobb levélnek (nagy melléklet) csak a fejadatai kerülnek be
const MAX_TEXT = 30000;
const addr = (a) => ({ name: String(a?.name || '').slice(0, 200), address: String(a?.address || '').toLowerCase().slice(0, 200) });

// client: csatlakozott ImapFlow; state: { uidValidity, lastUid } | null (az előző olvasásé)
// Visszaad: { mails: [{ id, uid, messageId, from, to, subject, date, text, attachments, token, replyText }], state }
// – az új state-et el kell menteni a következő olvasáshoz.
export async function readMailbox(client, state, { sinceDays = 14, max = 40 } = {}) {
  const lock = await client.getMailboxLock('INBOX');
  try {
    const validity = String(client.mailbox.uidValidity);
    const fresh = !state || String(state.uidValidity) !== validity;
    const lastUid = fresh ? 0 : Number(state.lastUid) || 0;
    const query = fresh ? { since: new Date(Date.now() - sinceDays * 86400000) } : { uid: `${lastUid + 1}:*` };
    // a „N:*” tartomány a legutolsó levelet akkor is visszaadja, ha az régebbi, ezért a régieket kiszűrjük
    const uids = ((await client.search(query, { uid: true })) || []).filter(u => u > lastUid).sort((a, b) => a - b).slice(0, max);
    let maxUid = lastUid;
    const heads = [];
    if (uids.length) {
      for await (const msg of client.fetch(uids, { uid: true, envelope: true, size: true, internalDate: true }, { uid: true })) {
        maxUid = Math.max(maxUid, msg.uid);
        heads.push(msg);
      }
    } else if (fresh) {
      maxUid = Math.max(0, (Number(client.mailbox.uidNext) || 1) - 1);
    }
    // a levél tartalma külön kérésben (a fetch ciklusán belül nem futhat másik parancs)
    const mails = [];
    for (const h of heads.sort((a, b) => a.uid - b.uid)) {
      const env = h.envelope || {};
      const to = [...(env.to || []), ...(env.cc || [])].map(addr);
      const token = replyTokenFrom(to.map(a => a.address));
      let text = ''; let attachments = []; let tooBig = false;
      if ((h.size || 0) <= MAX_SOURCE) {
        const full = await client.fetchOne(String(h.uid), { source: true }, { uid: true });
        if (full?.source) {
          const parsed = await simpleParser(full.source);
          text = String(parsed.text || htmlToText(parsed.html || '')).replace(/\r\n?/g, '\n').trim();
          attachments = (parsed.attachments || []).filter(a => a.contentDisposition !== 'inline' || a.filename).map(a => ({ filename: String(a.filename || 'melléklet').slice(0, 200), size: a.size || 0 }));
        }
      } else tooBig = true;
      mails.push({
        id: env.messageId || `imap-${validity}-${h.uid}`,
        uid: h.uid,
        messageId: env.messageId || '',
        from: addr((env.from || [])[0]),
        replyTo: env.replyTo?.length ? addr(env.replyTo[0]) : null, // a válasz ide megy (pl. az előrendelő oldal kérdéseinél a kérdező címe)
        to,
        subject: String(env.subject || '').slice(0, 300),
        date: env.date ? new Date(env.date) : (h.internalDate ? new Date(h.internalDate) : new Date()),
        text: text.slice(0, MAX_TEXT),
        attachments,
        tooBig,
        token,
        replyText: token ? (stripQuoted(text) || '(üres válasz)') : null,
      });
    }
    return { mails, state: { uidValidity: validity, lastUid: maxUid } };
  } finally {
    lock.release();
  }
}
