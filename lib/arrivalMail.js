// „Megérkezett” értesítő az előrendelőknek: a szervező az adminban szerkesztheti a tárgyat és a szöveget (sima szöveg,
// nem HTML), a {név} és a {darab} helyére vásárlónként a saját neve és darabszáma kerül. Ugyanez a függvény készíti
// a böngészőben az előnézetet és a szerveren a kiküldött levelet, így az előnézet pontosan az, ami kimegy.
import { escapeHtml, mailLayout } from './mailLayout.js';

export const ARRIVAL_SUBJECT_MAX = 200;
export const ARRIVAL_BODY_MAX = 5000;
export const ARRIVAL_PLACEHOLDERS = ['{név}', '{darab}'];

export const defaultArrivalSubject = (productName) => `Megérkezett: ${productName}`;
export const defaultArrivalBody = (productName) => `Kedves {név}!

Örömmel jelezzük, hogy megérkezett az előrendelt terméked: ${productName} ({darab} db).
A boltban nyitvatartási időben átveheted.

Köszönjük, hogy nálunk rendeltél!
Tavern`;

const fill = (text, { name, quantity }) => String(text).replace(/\{név\}/g, name || '').replace(/\{darab\}/g, String(quantity ?? ''));

// A beküldött tárgy és szöveg ellenőrzése. { subject, body } vagy { error }
export function sanitizeArrival(input) {
  const subject = String(input?.subject ?? '').trim().replace(/\s+/g, ' ');
  const body = String(input?.body ?? '').replace(/\r\n?/g, '\n').trim();
  if (!subject) return { error: 'Add meg a levél tárgyát.' };
  if (subject.length > ARRIVAL_SUBJECT_MAX) return { error: `A tárgy legfeljebb ${ARRIVAL_SUBJECT_MAX} karakter lehet.` };
  if (!body) return { error: 'A levél szövege nem lehet üres.' };
  if (body.length > ARRIVAL_BODY_MAX) return { error: `A levél legfeljebb ${ARRIVAL_BODY_MAX} karakter lehet.` };
  return { subject, body };
}

// Egy vásárló levele: { subject, html, text }
export function arrivalMail({ subject, body }, recipient) {
  const s = fill(subject, recipient).trim();
  const t = fill(body, recipient).trim();
  const paragraphs = t.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  return { subject: s, html: mailLayout(s, paragraphs), text: t };
}

// Kik kapják meg: e-mail címmel rendelkezők; skipHanded: akiknek már átadták, kimarad; skipNotified: aki már kapott értesítést, kimarad
export const arrivalRecipients = (orders, { skipHanded = true, skipNotified = true } = {}) => (orders || [])
  .filter(o => (o.email || o.hasEmail) && !(skipHanded && o.handedOverAt) && !(skipNotified && o.arrivalMailAt));
