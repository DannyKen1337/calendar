import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEmailDomain, suggestEmail } from './emailDomain.js';

const err = (code) => Object.assign(new Error(code), { code });
const resolver = (map) => ({
  async resolveMx(d) { const v = map[d]?.mx; if (v instanceof Error) throw v; if (!v) throw err('ENOTFOUND'); return v; },
  async resolve4(d) { const v = map[d]?.a; if (v instanceof Error) throw v; if (!v) throw err('ENODATA'); return v; },
  async resolve6(d) { const v = map[d]?.aaaa; if (v instanceof Error) throw v; if (!v) throw err('ENODATA'); return v; },
});
const opts = (map) => ({ resolver: resolver(map), useCache: false });

test('MX-rekorddal rendben, null MX-szel nem', async () => {
  assert.deepEqual(await checkEmailDomain('anna@pelda.hu', opts({ 'pelda.hu': { mx: [{ exchange: 'mx.pelda.hu', priority: 10 }] } })), { ok: true });
  const n = await checkEmailDomain('anna@nem.hu', opts({ 'nem.hu': { mx: [{ exchange: '.', priority: 0 }] } }));
  assert.equal(n.ok, false); assert.match(n.error, /nem fogad leveleket/);
});

test('MX nélkül az A rekord elég, semmivel nem', async () => {
  assert.equal((await checkEmailDomain('a@csak-a.hu', opts({ 'csak-a.hu': { mx: err('ENODATA'), a: ['192.0.2.1'] } }))).ok, true);
  const none = await checkEmailDomain('a@ures.hu', opts({ 'ures.hu': { mx: err('ENODATA') } }));
  assert.equal(none.ok, false); assert.match(none.error, /nem lehet levelet küldeni/);
  const nx = await checkEmailDomain('a@nincs-ilyen-domain.hu', opts({}));
  assert.equal(nx.ok, false); assert.match(nx.error, /nem létezik/);
});

test('DNS-hiba vagy időtúllépés: átengedi', async () => {
  assert.equal((await checkEmailDomain('a@lassu.hu', opts({ 'lassu.hu': { mx: err('ETIMEOUT') } }))).ok, true);
  assert.equal((await checkEmailDomain('a@hibas.hu', opts({ 'hibas.hu': { mx: err('ESERVFAIL') } }))).ok, true);
});

test('gyakori elírás: javaslat', async () => {
  assert.equal(suggestEmail('Kata@GMIAL.com'), 'kata@gmail.com');
  assert.equal(suggestEmail('kata@gmail.com'), null);
  const r = await checkEmailDomain('kata@freemial.hu', opts({}));
  assert.equal(r.ok, false); assert.equal(r.suggestion, 'kata@freemail.hu'); assert.match(r.error, /Erre gondoltál: kata@freemail\.hu\?/);
});
