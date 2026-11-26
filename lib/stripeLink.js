// Stripe fizetési link az előrendeléshez (a lib/preorders.js is továbbadja; külön fájl, hogy függőség nélkül tesztelhető legyen)
export const STRIPE_URL_MAX = 300;

// Stripe fizetési link („Megveszem most” gomb): csak https és a Stripe saját címe (buy.stripe.com, checkout.stripe.com),
// hogy a gombbal ne lehessen idegen (pl. adathalász) oldalra küldeni a vásárlót. { url } (üresen null) vagy { error }
export function normalizeStripeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { url: null };
  let u;
  try { u = new URL(raw); } catch { u = null; }
  if (!u || raw.length > STRIPE_URL_MAX || u.protocol !== 'https:' || !/^(buy|checkout)\.stripe\.com$/.test(u.hostname) || u.username || u.password || u.pathname.length < 2) {
    return { error: 'A Stripe link a Stripe fizetési linkje legyen (https://buy.stripe.com/…), vagy hagyd üresen.' };
  }
  u.hash = '';
  return { url: u.toString() };
}

// A vásárlónak kiküldött fizetési cím: az e-mail cím előre kitöltve, és a jelentkezés azonosítója (a Stripe-ban a
// fizetésnél „client_reference_id”-ként látszik, így a befizetés a jelentkezéshez köthető)
export function stripeCheckoutUrl(base, { email, ref } = {}) {
  const u = new URL(base);
  if (email) u.searchParams.set('prefilled_email', email);
  if (ref && /^[A-Za-z0-9_-]{1,200}$/.test(ref)) u.searchParams.set('client_reference_id', ref);
  return u.toString();
}
