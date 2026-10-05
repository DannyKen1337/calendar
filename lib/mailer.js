// E-mail küldés a Resend szolgáltatáson keresztül (https://resend.com, ingyenes szint: napi 100 levél).
// Beállítás (Vercel környezeti változók):
//   RESEND_API_KEY  – a Resend API kulcs
//   MAIL_FROM       – feladó, pl. "Tavern Naptár <naptar@tavern.hu>" (a domaint a Resendben hitelesíteni kell)
//   APP_URL         – a naptár címe a levelekben lévő linkekhez, pl. https://taverncalendar.vercel.app
// Ha nincs beállítva, a rendszer e-mail nélkül működik tovább (a leiratkozás ilyenkor megerősítés nélküli).

export const isMailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export const appUrl = (request) => (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');

export const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export async function sendMail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`E-mail küldés sikertelen (${res.status})`);
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
