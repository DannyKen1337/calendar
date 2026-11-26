import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { adminPath, isGatedPage, isGatedApi, gateToken, passesGate } from './adminGate.js';

const env = { ADMIN_PATH: '/ajto-8f2k3m9q', JWT_SECRET: 'teszt_titok_teszt_titok_teszt_titok_1' };

test('a titkos cím: legalább 8 karakter, betű, szám, kötőjel', () => {
  assert.equal(adminPath(env), '/ajto-8f2k3m9q');
  assert.equal(adminPath({ ADMIN_PATH: 'ajto-8f2k3m9q/' }), '/ajto-8f2k3m9q');
  assert.equal(adminPath({}), null);
  assert.equal(adminPath({ ADMIN_PATH: '/rovid' }), null);
  assert.equal(adminPath({ ADMIN_PATH: '/admin-titkos-123' }), null); // az /admin alá nem eshet
  assert.equal(adminPath({ ADMIN_PATH: '/a/b/c/d/e/f' }), null);
  assert.equal(adminPath({ ADMIN_PATH: '/ékezetes-cím' }), null);
});

test('mi van a kapu mögött', () => {
  for (const p of ['/admin', '/admin/', '/admin/liga', '/weblapteszt/admin', '/weblapteszt/elonezet/hirek/1']) assert.ok(isGatedPage(p), p);
  for (const p of ['/', '/embed', '/adminisztracio', '/weblapteszt', '/weblapteszt/galeria', '/esemeny/1']) assert.ok(!isGatedPage(p), p);
  assert.ok(isGatedApi('/api/auth', 'POST'));
  assert.ok(!isGatedApi('/api/auth', 'GET'));
  assert.ok(!isGatedApi('/api/auth/session', 'GET'));
  assert.ok(!isGatedApi('/api/auth/logout', 'POST'));
});

test('kapu-süti: a helyes átenged, a hamis és a régi címé nem', async () => {
  const good = await gateToken('/ajto-8f2k3m9q', env);
  assert.match(good, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(await passesGate({ gateCookie: good, path: '/ajto-8f2k3m9q', env }));
  assert.ok(!(await passesGate({ gateCookie: good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A'), path: '/ajto-8f2k3m9q', env })));
  assert.ok(!(await passesGate({ gateCookie: await gateToken('/regi-cim-12345', env), path: '/ajto-8f2k3m9q', env })), 'a cím cseréje után a régi süti érvénytelen');
  assert.ok(!(await passesGate({ gateCookie: await gateToken('/ajto-8f2k3m9q', { ...env, JWT_SECRET: 'masik_titok_masik_titok_masik_titok_99' }), path: '/ajto-8f2k3m9q', env })));
  assert.ok(!(await passesGate({ path: '/ajto-8f2k3m9q', env })));
});

test('aki be van lépve, azt átengedi', async () => {
  const jwt = await new SignJWT({ id: 'x' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(env.JWT_SECRET));
  assert.ok(await passesGate({ sessionCookie: jwt, path: '/ajto-8f2k3m9q', env }));
  const fake = await new SignJWT({ id: 'x' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('hamis_kulcs_hamis_kulcs_hamis_kulcs'));
  assert.ok(!(await passesGate({ sessionCookie: fake, path: '/ajto-8f2k3m9q', env })));
  assert.ok(!(await passesGate({ sessionCookie: 'nem-jwt', path: '/ajto-8f2k3m9q', env })));
});
