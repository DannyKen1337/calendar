import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactRecipient, sanitizeQuestion, questionMail } from './contactMail.js';

test('címzett: CONTACT_EMAIL, különben a postafiók, különben a MAIL_FROM címe', () => {
  assert.equal(contactRecipient({ CONTACT_EMAIL: 'bolt@tavern.hu', SMTP_USER: 'x@gmail.com' }), 'bolt@tavern.hu');
  assert.equal(contactRecipient({ SMTP_USER: 'tavern.naptar@gmail.com' }), 'tavern.naptar@gmail.com');
  assert.equal(contactRecipient({ MAIL_FROM: 'Tavern Naptár <naptar@tavern.hu>' }), 'naptar@tavern.hu');
  assert.equal(contactRecipient({}), null);
  assert.equal(contactRecipient({ CONTACT_EMAIL: 'nem cím' }), null);
});

test('ellenőrzés: név, e-mail és üzenet kötelező', () => {
  assert.equal(sanitizeQuestion({ email: 'a@b.hu', message: 'Mikor jön?' }).field, 'name');
  assert.equal(sanitizeQuestion({ name: 'Anna', email: 'rossz', message: 'Mikor jön?' }).field, 'email');
  assert.equal(sanitizeQuestion({ name: 'Anna', email: 'a@b.hu', message: 'hm' }).field, 'message');
  assert.equal(sanitizeQuestion({ name: 'Anna', email: 'a@b.hu', message: 'x'.repeat(3001) }).field, 'message');
  assert.equal(sanitizeQuestion({ name: 'Anna', email: 'a@b.hu<x>', message: 'Mikor jön?' }).field, 'email');
  assert.deepEqual(sanitizeQuestion({ name: '  Kiss   Anna ', email: ' Anna@B.hu ', message: ' Mikor jön?\r\nKöszi ' }).question, { name: 'Kiss Anna', email: 'anna@b.hu', message: 'Mikor jön?\nKöszi' });
});

test('levél: a válaszcím a kérdezőé, a szöveg escape-elve', () => {
  const m = questionMail({ name: 'Kiss <Anna>', email: 'anna@b.hu', message: 'Mikor jön?\n<script>x</script>', product: 'ETB' });
  assert.equal(m.replyTo, 'anna@b.hu');
  assert.match(m.subject, /Kérdés az előrendelésről – ETB \(Kiss <Anna>\)/);
  assert.match(m.html, /Kiss &lt;Anna&gt;/);
  assert.match(m.html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.text, /Mikor jön\?/);
  assert.doesNotMatch(questionMail({ name: 'A', email: 'a@b.hu', message: 'Kérdés' }).subject, /–/);
});
