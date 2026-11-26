import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp, frameAncestors, newNonce } from './csp.js';

const env = { CALENDAR_URL: 'https://taverncalendar.vercel.app' };
const dir = (csp, name) => csp.split('; ').find(d => d.startsWith(`${name} `)) || null;

test('nyilvános oldal: csak nonce-os script, eval nélkül', () => {
  const csp = buildCsp({ nonce: 'abc', pathname: '/', env });
  assert.equal(dir(csp, 'script-src'), "script-src 'self' 'nonce-abc' 'strict-dynamic'");
  assert.equal(dir(csp, 'object-src'), "object-src 'none'");
  assert.equal(dir(csp, 'base-uri'), "base-uri 'self'");
  assert.ok(csp.includes('upgrade-insecure-requests'));
  assert.ok(!/unsafe-inline/.test(dir(csp, 'script-src')));
});

test('szerkesztőfelület: eval a HEIC-átalakítóhoz', () => {
  assert.ok(dir(buildCsp({ nonce: 'n', pathname: '/admin/liga', env }), 'script-src').includes("'unsafe-eval'"));
  assert.ok(dir(buildCsp({ nonce: 'n', pathname: '/weblapteszt/admin', env }), 'script-src').includes("'unsafe-eval'"));
  assert.ok(!dir(buildCsp({ nonce: 'n', pathname: '/adminisztrator', env }), 'script-src').includes("'unsafe-eval'"));
  assert.ok(!dir(buildCsp({ nonce: 'n', pathname: '/weblapteszt', env }), 'script-src').includes("'unsafe-eval'"));
});

test('fejlesztői módban eval és websocket (HMR), https-re váltás nélkül', () => {
  const csp = buildCsp({ nonce: 'n', pathname: '/', dev: true, env });
  assert.ok(dir(csp, 'script-src').includes("'unsafe-eval'"));
  assert.ok(dir(csp, 'connect-src').includes('ws:'));
  assert.ok(!csp.includes('upgrade-insecure-requests'));
});

test('keretek: a naptár és a Google Térkép', () => {
  assert.equal(dir(buildCsp({ nonce: 'n', env }), 'frame-src'), "frame-src 'self' https://taverncalendar.vercel.app https://maps.google.com https://www.google.com");
});

test('beágyazás oldalanként', () => {
  assert.equal(frameAncestors('/admin', {}), "'none'");
  assert.equal(frameAncestors('/admin/felhasznalok', {}), "'none'");
  assert.equal(frameAncestors('/weblapteszt/admin', {}), "'none'");
  assert.equal(frameAncestors('/leiratkozas', {}), "'none'");
  assert.equal(frameAncestors('/', {}), null);
  assert.equal(frameAncestors('/embed', {}), null);
  assert.equal(frameAncestors('/asztalfoglalas', {}), "'self' https://tavern.hu https://*.tavern.hu");
  assert.equal(frameAncestors('/weblapteszt/galeria/x', { WEBSHOP_URL: 'https://bolt.freewebstore.org/termekek', FRAME_ANCESTORS: 'https://pelda.hu javascript:alert(1) http://nem-https.hu' }),
    "'self' https://tavern.hu https://*.tavern.hu https://bolt.freewebstore.org https://pelda.hu");
  assert.ok(buildCsp({ nonce: 'n', pathname: '/admin', env }).includes("frame-ancestors 'none'"));
  assert.ok(!buildCsp({ nonce: 'n', pathname: '/embed', env }).includes('frame-ancestors'));
});

test('a nonce minden hívásnál más, és base64', () => {
  const a = newNonce(), b = newNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
});
