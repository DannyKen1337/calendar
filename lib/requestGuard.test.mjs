import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCrossOriginWrite } from './requestGuard.js';

const host = 'taverncalendar.vercel.app';

test('saját címről jövő írás átmegy', () => {
  assert.equal(isCrossOriginWrite({ method: 'POST', origin: `https://${host}`, host }), false);
  assert.equal(isCrossOriginWrite({ method: 'POST', origin: 'http://localhost:3179', host: 'localhost:3179' }), false);
});

test('idegen címről jövő írás tiltott (aldomain is)', () => {
  assert.equal(isCrossOriginWrite({ method: 'POST', origin: 'https://gonosz.example', host }), true);
  assert.equal(isCrossOriginWrite({ method: 'DELETE', origin: 'https://shop.tavern.hu', host: 'tavern.hu' }), true);
  assert.equal(isCrossOriginWrite({ method: 'POST', origin: 'null', host }), true);
  assert.equal(isCrossOriginWrite({ method: 'POST', origin: 'nem url', host }), true);
});

test('olvasás és Origin nélküli kérés átmegy', () => {
  assert.equal(isCrossOriginWrite({ method: 'GET', origin: 'https://gonosz.example', host }), false);
  assert.equal(isCrossOriginWrite({ method: 'POST', origin: null, host }), false);
});
