import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalMail, sanitizeArrival, arrivalRecipients, defaultArrivalBody, defaultArrivalSubject } from './arrivalMail.js';

test('alapszöveg: a termék neve benne, a név és a darab vásárlónként', () => {
  const m = arrivalMail({ subject: defaultArrivalSubject('Mega ETB'), body: defaultArrivalBody('Mega ETB') }, { name: 'Kiss Anna', quantity: 2 });
  assert.equal(m.subject, 'Megérkezett: Mega ETB');
  assert.match(m.text, /^Kedves Kiss Anna!/);
  assert.match(m.text, /Mega ETB \(2 db\)/);
  assert.match(m.html, /Kedves Kiss Anna!/);
  assert.doesNotMatch(m.html, /\{név\}|\{darab\}/);
});

test('a szöveg escape-elve, bekezdések és sortörések megmaradnak', () => {
  const m = arrivalMail({ subject: 'Hello {név}', body: 'Első sor\nmásodik sor\n\n<script>x</script>' }, { name: '<b>Béla</b>', quantity: 1 });
  assert.equal(m.subject, 'Hello <b>Béla</b>');
  assert.match(m.html, /Hello &lt;b&gt;Béla&lt;\/b&gt;/);
  assert.match(m.html, /Első sor<br>második sor<\/p>/);
  assert.match(m.html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(m.html, /<script>|<b>Béla/);
});

test('ellenőrzés', () => {
  assert.ok(sanitizeArrival({ subject: '', body: 'x' }).error);
  assert.ok(sanitizeArrival({ subject: 'x', body: '  ' }).error);
  assert.ok(sanitizeArrival({ subject: 'x'.repeat(201), body: 'x' }).error);
  assert.ok(sanitizeArrival({ subject: 'x', body: 'x'.repeat(5001) }).error);
  assert.deepEqual(sanitizeArrival({ subject: '  Megérkezett:  ETB ', body: ' Szia\r\n\r\nJó ' }), { subject: 'Megérkezett: ETB', body: 'Szia\n\nJó' });
});

test('címzettek: az átvettek és a már értesítettek kimaradhatnak', () => {
  const orders = [{ id: 1, email: 'a@x.hu' }, { id: 2, email: 'b@x.hu', handedOverAt: new Date() }, { id: 3, hasEmail: true, arrivalMailAt: new Date() }, { id: 4 }];
  assert.deepEqual(arrivalRecipients(orders).map(o => o.id), [1]);
  assert.deepEqual(arrivalRecipients(orders, { skipHanded: false, skipNotified: false }).map(o => o.id), [1, 2, 3]);
});
