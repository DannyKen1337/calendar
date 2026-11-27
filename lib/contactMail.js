// Kérdés az előrendelő oldalról („Kérdésed van? Írj nekünk”): a levél a bolt postafiókjába megy, a válaszcím a kérdezőé,
// így a postafiókban a „Válasz” gombbal közvetlenül neki lehet válaszolni. A kérdezőnek nem megy levél (különben bárki
// tetszőleges szöveget küldhetne vele idegen címekre).
import { escapeHtml, mailLayout } from './mailer.js';

export const CONTACT_NAME_MAX = 120;
export const CONTACT_MESSAGE_MIN = 5;
export const CONTACT_MESSAGE_MAX = 3000;

// Címzett: CONTACT_EMAIL, különben a küldő postafiók (SMTP_USER), különben a MAIL_FROM címe. null, ha nincs.
export function contactRecipient(env = process.env) {
  const pick = (v) => { const m = String(v || '').match(/<([^<>\s]+@[^<>\s]+)>|^\s*([^<>\s]+@[^<>\s]+)\s*$/); return m ? (m[1] || m[2]) : null; };
  return pick(env.CONTACT_EMAIL) || pick(env.SMTP_USER) || pick(env.MAIL_FROM);
}

// A beküldött adatok ellenőrzése. { question } vagy { error, field }
export function sanitizeQuestion(input) {
  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ');
  const email = String(input?.email ?? '').trim().toLowerCase();
  const message = String(input?.message ?? '').replace(/\r\n?/g, '\n').trim();
  if (!name || name.length > CONTACT_NAME_MAX) return { error: 'Add meg a neved.', field: 'name' };
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) || email.length > 200) return { error: 'Érvényes e-mail címet adj meg (pl. nev@pelda.hu).', field: 'email' };
  if (message.length < CONTACT_MESSAGE_MIN) return { error: 'Írd le röviden, miben segíthetünk.', field: 'message' };
  if (message.length > CONTACT_MESSAGE_MAX) return { error: `Az üzenet legfeljebb ${CONTACT_MESSAGE_MAX} karakter lehet.`, field: 'message' };
  return { question: { name, email, message } };
}

// A bolt postafiókjába menő levél. product: a termék neve, ha egy termék oldaláról írtak; source: 'weboldal', ha a
// weboldal „Írj nekünk” részéből jött (különben az előrendelő oldalról)
export function questionMail({ name, email, message, product = '', source = '' }) {
  if (source === 'weboldal') {
    return {
      subject: `Üzenet a weboldalról (${name})`.slice(0, 200),
      replyTo: email,
      html: mailLayout('Üzenet a weboldalról', `
      <p><b>${escapeHtml(name)}</b> (<a href="mailto:${escapeHtml(email)}" style="color:#E5B15D">${escapeHtml(email)}</a>) írt a weboldal „Írj nekünk” részéből:</p>
      <div style="white-space:pre-wrap;background:#121212;border-radius:8px;padding:12px 14px">${escapeHtml(message)}</div>
      <p style="color:#9a8a8c;font-size:13px">Válaszolj erre a levélre: a válasz közvetlenül a kérdezőnek megy.</p>
    `),
      text: `${name} (${email}) írt a weboldal „Írj nekünk” részéből:\n\n${message}\n\nVálaszolj erre a levélre: a válasz közvetlenül a kérdezőnek megy.`,
    };
  }
  const about = product ? ` – ${product}` : '';
  return {
    subject: `Kérdés az előrendelésről${about} (${name})`.slice(0, 200),
    replyTo: email,
    html: mailLayout('Kérdés az előrendelő oldalról', `
      <p><b>${escapeHtml(name)}</b> (<a href="mailto:${escapeHtml(email)}" style="color:#E5B15D">${escapeHtml(email)}</a>) írt${product ? ` a(z) <b>${escapeHtml(product)}</b> előrendelésénél` : ''}:</p>
      <div style="white-space:pre-wrap;background:#121212;border-radius:8px;padding:12px 14px">${escapeHtml(message)}</div>
      <p style="color:#9a8a8c;font-size:13px">Válaszolj erre a levélre: a válasz közvetlenül a kérdezőnek megy.</p>
    `),
    text: `${name} (${email}) írt${product ? ` a(z) ${product} előrendelésénél` : ''}:\n\n${message}\n\nVálaszolj erre a levélre: a válasz közvetlenül a kérdezőnek megy.`,
  };
}
