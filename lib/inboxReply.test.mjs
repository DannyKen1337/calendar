import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replySubject, replyRecipient, buildReply, fromNameFor } from './inboxReply.js';

test('tárgy: Re: elé, ha még nincs', () => {
  assert.equal(replySubject('Kérdés az ETB-ről'), 'Re: Kérdés az ETB-ről');
  assert.equal(replySubject('Re: valami'), 'Re: valami');
  assert.equal(replySubject('RE:valami'), 'RE:valami');
  assert.equal(replySubject(''), 'Re: (nincs tárgy)');
});

test('címzett: a Reply-To, különben a feladó; a rendszer saját címe soha', () => {
  const own = ['tavern.naptar@gmail.com'];
  assert.equal(replyRecipient({ from: { address: 'tavern.naptar@gmail.com' }, replyTo: { address: 'Kata@Pelda.hu', name: 'Kata' } }, own).address, 'kata@pelda.hu');
  assert.equal(replyRecipient({ from: { address: 'bela@pelda.hu', name: 'Béla' } }, own).address, 'bela@pelda.hu');
  assert.equal(replyRecipient({ from: { address: 'tavern.naptar@gmail.com' } }, own), null);
  assert.equal(replyRecipient({ from: { address: 'nem cím' } }, own), null);
  assert.equal(replyRecipient({ from: { address: 'x@y.hu' }, replyTo: { address: 'tavern.naptar@gmail.com' } }, own).address, 'x@y.hu');
});

test('a belépett felhasználó írja alá, alatta az idézett eredeti levél', () => {
  const r = buildReply({ text: 'Szia!\n\nSzombaton átveheted.', username: 'Kata', original: { subject: 'Mikor jön?', from: { name: 'Béla', address: 'bela@pelda.hu' }, date: '2026-11-26T10:00:00Z', text: 'Mikor jön az ETB?\n<script>x</script>' } });
  assert.equal(r.subject, 'Re: Mikor jön?');
  assert.match(r.text, /^Szia!\n\nSzombaton átveheted\.\n\nKata\nTavern\n\n.*Béla írta:\n> Mikor jön az ETB\?\n> <script>x<\/script>$/s);
  assert.match(r.html, /Kata<br>Tavern/);
  assert.match(r.html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(r.html, /<script>/);
  assert.equal(fromNameFor('Kata'), 'Kata – Tavern');
});
