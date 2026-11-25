// E-mail küldés. Két mód (Vercel környezeti változók):
// 1) SMTP – egy meglévő postafiókból (átmenetileg egy Gmail-fiókból, vagy a domainhez járó postafiókból):
//   SMTP_HOST  – pl. smtp.gmail.com
//   SMTP_PORT  – 465 (SSL, alapértelmezett) vagy 587
//   SMTP_USER  – a postafiók címe, pl. taverncalendar@gmail.com
//   SMTP_PASS  – a jelszava (Gmailnél alkalmazásjelszó: kétlépcsős azonosítás után a Google-fiókban hozható létre)
//   MAIL_FROM  – nem kötelező; alapból "Tavern Naptár <SMTP_USER>". Gmailnél a cím maradjon az SMTP_USER.
// 2) Resend (https://resend.com): RESEND_API_KEY + MAIL_FROM (a domaint a Resendben hitelesíteni kell). Ha mindkettő be
//    van állítva, a Resend megy. A szervezői üzenetekre jövő válaszok csak a Resend fogadó domainjével jutnak vissza a
//    rendszerbe a webhookon (lib/messages.js); SMTP módban a postafiók „+” címére (tavern.naptar+valasz-<token>@gmail.com),
//    és a rendszer IMAP-pal olvassa vissza (imapConfig, lib/mailboxSync.js).
//   APP_URL – a naptár címe a levelekben lévő linkekhez, pl. https://taverncalendar.vercel.app
// Ha egyik sincs beállítva, a rendszer e-mail nélkül működik tovább (a leiratkozás ilyenkor megerősítés nélküli).

const resendOn = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const smtpOn = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
export const isMailConfigured = () => resendOn() || smtpOn();

// A postafiók olvasása (IMAP) a válaszokhoz és a Beérkezett levelekhez (lib/mailboxSync.js): SMTP-s küldésnél ugyanazzal
// a fiókkal. Gmailnél magától imap.gmail.com:993; más postafióknál IMAP_HOST (és IMAP_PORT, alapból 993) kell.
export function imapConfig() {
  if (resendOn() || !smtpOn()) return null;
  const host = process.env.IMAP_HOST || (/(^|\.)gmail\.com$/i.test(process.env.SMTP_HOST) ? 'imap.gmail.com' : '');
  if (!host) return null;
  return { host, port: Number(process.env.IMAP_PORT) || 993, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
}

export const appUrl = (request) => (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');

export const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// replyTo: a válaszcím (a szervezői üzeneteknél a rendszer saját fogadó címe, lib/messages.js); text: a sima szöveges változat
export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!resendOn() && smtpOn()) return sendSmtp({ to, subject, html, text, replyTo });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, ...(text && { text }), ...(replyTo && { reply_to: replyTo }) }),
  });
  if (!res.ok) throw new Error(`E-mail küldés sikertelen (${res.status})`);
}

let transport = null;
async function sendSmtp({ to, subject, html, text, replyTo }) {
  if (!transport) {
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 465;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      ...(process.env.SMTP_INSECURE_TEST && { tls: { rejectUnauthorized: false }, ignoreTLS: true }), // csak a teszthez
    });
  }
  const from = process.env.MAIL_FROM || `"Tavern Naptár" <${process.env.SMTP_USER}>`;
  try {
    await transport.sendMail({ from, to, subject, html, ...(text && { text }), ...(replyTo && { replyTo }) });
  } catch (e) {
    transport = null; // a következő küldés új kapcsolattal próbálkozik
    throw new Error(`E-mail küldés sikertelen (${e.responseCode || e.code || 'SMTP'})`);
  }
}

// Egyszerű, sötét témájú levélsablon
export function mailLayout(title, bodyHtml) {
  return `<div style="font-family:Georgia,serif;background:#121212;padding:24px;color:#E0D6C8">
  <div style="max-width:520px;margin:0 auto;background:#1a1012;border:1px solid #4A2E33;border-radius:12px;padding:24px">
    <h2 style="color:#E5B15D;margin-top:0">${escapeHtml(title)}</h2>
    ${bodyHtml}
  </div>
</div>`;
}

export const mailButton = (href, label) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#E5B15D;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
