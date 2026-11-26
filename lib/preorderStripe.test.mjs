import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStripeUrl, stripeCheckoutUrl } from './stripeLink.js';
import { preorderMail } from './preorderMail.js';

test('Stripe link: csak a Stripe saját https címe', () => {
  assert.deepEqual(normalizeStripeUrl(''), { url: null });
  assert.deepEqual(normalizeStripeUrl('   '), { url: null });
  assert.equal(normalizeStripeUrl(' https://buy.stripe.com/test_abc123 ').url, 'https://buy.stripe.com/test_abc123');
  assert.equal(normalizeStripeUrl('https://buy.stripe.com/abc#x').url, 'https://buy.stripe.com/abc');
  assert.ok(normalizeStripeUrl('https://checkout.stripe.com/c/pay/cs_live_x').url);
  for (const bad of ['http://buy.stripe.com/abc', 'https://buy.stripe.com.gonosz.hu/abc', 'https://gonosz.hu/buy.stripe.com', 'javascript:alert(1)', 'https://user:pw@buy.stripe.com/abc', 'https://buy.stripe.com/', 'buy.stripe.com/abc', 'https://stripe.com/abc']) {
    assert.ok(normalizeStripeUrl(bad).error, bad);
  }
});

test('fizetési cím: előre kitöltött e-mail és jelentkezés-azonosító', () => {
  const u = new URL(stripeCheckoutUrl('https://buy.stripe.com/abc?locale=hu', { email: 'a+b@pelda.hu', ref: '65a1b2c3d4e5f60718293a4b' }));
  assert.equal(u.searchParams.get('prefilled_email'), 'a+b@pelda.hu');
  assert.equal(u.searchParams.get('client_reference_id'), '65a1b2c3d4e5f60718293a4b');
  assert.equal(u.searchParams.get('locale'), 'hu');
  assert.equal(new URL(stripeCheckoutUrl('https://buy.stripe.com/abc', { ref: 'rossz azonosító!' })).searchParams.get('client_reference_id'), null);
});

test('levél: „Megveszem most” esetén köszönő levél a fizetési linkkel', () => {
  const items = [{ name: 'Doboz <b>', category: 'Pokémon TCG', quantity: 2 }];
  const buy = preorderMail({ name: 'Kiss Anna', items, checkoutUrl: 'https://buy.stripe.com/x1?prefilled_email=a%40b.hu&client_reference_id=1' });
  assert.match(buy.subject, /Köszönjük, hogy feliratkoztál/);
  assert.match(buy.html, /href="https:\/\/buy\.stripe\.com\/x1\?prefilled_email=a%40b\.hu&amp;client_reference_id=1"/);
  assert.match(buy.html, /Doboz &lt;b&gt;/);
  assert.match(buy.html, /2 db/);
  const plain = preorderMail({ name: 'Kiss Anna', items });
  assert.match(plain.subject, /visszaigazolása/);
  assert.doesNotMatch(plain.html, /stripe/i);
});
