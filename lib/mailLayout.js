// Levélsablon és HTML-escape: függőség nélkül, a szerveren és a böngészőben (előnézet) is használható
export const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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
