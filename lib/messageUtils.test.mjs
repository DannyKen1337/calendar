import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { replyTokenFrom, replyAddress, newReplyToken, stripQuoted, htmlToText, verifySvix, cleanMessageText } from './messageUtils.js';

test('válaszcím és token', () => {
  const t = newReplyToken();
  assert.match(t, /^[0-9a-f]{24}$/);
  assert.equal(replyTokenFrom([replyAddress(t, 'abc.resend.app')]), t);
  assert.equal(replyTokenFrom(['Tavern <valasz-' + t + '@valasz.tavern.hu>', 'mas@x.hu']), t);
  assert.equal(replyTokenFrom(['valasz-rovid@x.hu', 'barki@x.hu']), null);
  assert.equal(replyTokenFrom(null), null);
});

test('az idézett előzmény levágása', () => {
  assert.equal(stripQuoted('Köszi, jövök!\n\n2026. nov. 17., K 10:12 Tavern <naptar@tavern.hu> írta:\n> Szia!\n> Megjött az ETB.'), 'Köszi, jövök!');
  assert.equal(stripQuoted('Ok\r\n\r\nOn Tue, Nov 17, 2026 at 10:12 Tavern wrote:\r\n> hi'), 'Ok');
  assert.equal(stripQuoted('Rendben\n-----Original Message-----\nFrom: x'), 'Rendben');
  assert.equal(stripQuoted('Első sor\nMásodik sor'), 'Első sor\nMásodik sor');
  assert.equal(stripQuoted('x'.repeat(5000)).length, 4000);
});

test('HTML levél szövege', () => {
  assert.equal(htmlToText('<div>Szia<br>jövök &amp; hozom</div><style>p{}</style>').trim(), 'Szia\njövök & hozom');
});

test('Svix aláírás', () => {
  const secret = 'whsec_' + Buffer.from('titkos-kulcs-1234567890').toString('base64');
  const body = '{"type":"email.received"}';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', Buffer.from('titkos-kulcs-1234567890')).update(`msg_1.${ts}.${body}`).digest('base64');
  assert.equal(verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,${sig}` }, body), true);
  assert.equal(verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,rossz v1,${sig}` }, body), true);
  assert.equal(verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,${sig}` }, body + ' '), false);
  assert.equal(verifySvix(secret, { id: 'msg_1', timestamp: String(Number(ts) - 900), signature: `v1,${sig}` }, body), false);
  assert.equal(verifySvix('', { id: 'msg_1', timestamp: ts, signature: `v1,${sig}` }, body), false);
});

test('üzenet szövege', () => {
  assert.deepEqual(cleanMessageText('  szia  '), { text: 'szia' });
  assert.ok(cleanMessageText('   ').error);
  assert.ok(cleanMessageText('x'.repeat(4001)).error);
});
