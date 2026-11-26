// Az előrendelő visszaigazoló levele. „Megveszem most” esetén (checkoutUrl) köszönő levél a fizetési linkkel,
// hogy a vásárló később is befejezhesse a fizetést; különben a szokásos visszaigazolás.
import { escapeHtml, mailLayout, mailButton } from './mailer.js';

export function preorderMail({ name, items, checkoutUrl = null }) {
  const list = items.map(i => `<li><b>${escapeHtml(i.name)}</b> (${escapeHtml(i.category)}) – ${i.quantity} db</li>`).join('');
  if (checkoutUrl) {
    return {
      subject: 'Köszönjük, hogy feliratkoztál! – Tavern',
      html: mailLayout('Köszönjük, hogy feliratkoztál!', `
        <p>Kedves ${escapeHtml(name)}!</p>
        <p>Köszönjük, hogy feliratkoztál az alábbi termékre:</p>
        <ul>${list}</ul>
        <p>A fizetés a Stripe biztonságos oldalán történik. Ha még nem fizettél, itt folytathatod:</p>
        ${mailButton(checkoutUrl, 'Fizetés')}
        <p>Amikor a termék megérkezik, a megadott elérhetőségeiden keresünk.</p>
      `),
    };
  }
  return {
    subject: 'Előrendelésed visszaigazolása – Tavern',
    html: mailLayout('Előrendelés visszaigazolása', `
      <p>Kedves ${escapeHtml(name)}!</p>
      <p>Megkaptuk az előrendelésedet az alábbi termékekre:</p>
      <ul>${list}</ul>
      <p>Amikor a termék megérkezik, a megadott elérhetőségeiden keresünk.</p>
    `),
  };
}
