// Válasz a Beérkezett levelekre az admin felületről: a levél a rendszer postafiókjából megy, a belépett felhasználó
// aláírásával (a megjelenő feladónév is az övé: "Kata – Tavern"). Az eredeti levél idézve kerül alá, és a válasz az
// eredeti szálába kerül (In-Reply-To / References). Függőség nélkül: a böngészőben (előnézet) és a szerveren is fut.
import { escapeHtml, mailLayout } from './mailLayout.js';

export const REPLY_MAX = 10000;

export const replySubject = (subject) => {
  const s = String(subject || '').trim();
  if (!s) return 'Re: (nincs tárgy)';
  return /^(re|vá|va|válasz)\s*:/i.test(s) ? s : `Re: ${s}`;
};

export const signatureFor = (username) => `${String(username || '').trim() || 'Tavern'}\nTavern`;
export const fromNameFor = (username) => `${String(username || '').trim() || 'Tavern'} – Tavern`;

// Kinek megy a válasz: a Reply-To címre (pl. az előrendelő oldal kérdéseinél a kérdezőé), különben a feladónak.
// A rendszer saját címére nem (ownAddresses: a postafiók címei). null, ha nincs hova válaszolni.
export function replyRecipient(mail, ownAddresses = []) {
  const own = new Set(ownAddresses.filter(Boolean).map(a => String(a).toLowerCase()));
  for (const a of [mail?.replyTo, mail?.from]) {
    const address = String(a?.address || '').trim().toLowerCase();
    if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(address) && !own.has(address)) return { address, name: a?.name || '' };
  }
  return null;
}

const when = (d) => (d ? new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// A kiküldött levél: { subject, text, html }. original: { subject, from, date, text }
export function buildReply({ text, username, original }) {
  const body = String(text || '').replace(/\r\n?/g, '\n').trim();
  const signature = signatureFor(username);
  const who = original?.from?.name || original?.from?.address || '';
  const quoteHead = `${when(original?.date)}${who ? `, ${who} írta:` : ':'}`;
  const quoted = String(original?.text || '').trim().split('\n').slice(0, 200).map(l => `> ${l}`).join('\n');
  const subject = replySubject(original?.subject);
  const paragraphs = body.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  const html = mailLayout('Tavern', `${paragraphs}
    <p style="margin:18px 0 0;line-height:1.5">${escapeHtml(signature).replace(/\n/g, '<br>')}</p>
    ${quoted ? `<div style="margin-top:24px;padding-left:12px;border-left:3px solid #4A2E33;color:#9a8a8c;font-size:13px;white-space:pre-line">${escapeHtml(quoteHead)}\n${escapeHtml(String(original.text).trim().split('\n').slice(0, 200).join('\n'))}</div>` : ''}`);
  return { subject, text: `${body}\n\n${signature}${quoted ? `\n\n${quoteHead}\n${quoted}` : ''}`, html };
}
