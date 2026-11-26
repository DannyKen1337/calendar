import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Encode, base32Decode, hotp, totpCode, verifyTotp, otpauthUri, newSecret, newRecoveryCodes, hashRecoveryCodes, matchRecoveryCode, looksLikeRecovery, currentStep } from './totp.js';

// RFC 6238 B függelék: a titok "12345678901234567890" (ASCII), SHA1, 8 számjegy -> 6 számjegyre az utolsó 6 jegy
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
test('RFC 6238 tesztvektorok', () => {
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']];
  for (const [t, expected] of vectors) assert.equal(hotp(RFC_SECRET, Math.floor(t / 30), 8), expected, String(t));
  assert.equal(totpCode(RFC_SECRET, 59 * 1000), '287082');
});

test('base32 oda-vissza', () => {
  const s = newSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.equal(base32Encode(base32Decode(s)), s);
  assert.equal(base32Decode('mfrg gzdf mztw q2lk').toString(), 'abcdefghij');
});

test('ellenőrzés: ±30 mp, újrafelhasználás tiltva, hibás formátum', () => {
  const s = newSecret();
  const now = 1_800_000_000_000;
  const code = totpCode(s, now);
  const step = verifyTotp(s, code, { now });
  assert.equal(step, currentStep(now));
  assert.equal(verifyTotp(s, code, { now: now + 30_000 }), step, 'a következő 30 mp-ben még jó');
  assert.equal(verifyTotp(s, code, { now: now + 90_000 }), null, '90 mp múlva már nem');
  assert.equal(verifyTotp(s, code, { now, lastStep: step }), null, 'kétszer nem használható');
  assert.equal(verifyTotp(s, '12345', { now }), null);
  assert.equal(verifyTotp(s, 'abcdef', { now }), null);
  assert.equal(verifyTotp(s, ` ${code.slice(0, 3)} ${code.slice(3)} `, { now }), step, 'a szóköz nem számít');
});

test('otpauth cím', () => {
  const uri = otpauthUri('ABC', 'Kovács Péter');
  assert.equal(uri, 'otpauth://totp/Tavern%20Admin%3AKov%C3%A1cs%20P%C3%A9ter?secret=ABC&issuer=Tavern%20Admin&algorithm=SHA1&digits=6&period=30');
});

test('tartalék kódok: egyszer használható, kis/nagybetű és kötőjel nem számít', async () => {
  const codes = newRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every(c => /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(c) && looksLikeRecovery(c)));
  const hashes = await hashRecoveryCodes(codes.slice(0, 3));
  assert.equal(await matchRecoveryCode(codes[1].toUpperCase().replace('-', ' '), hashes), 1);
  assert.equal(await matchRecoveryCode('aaaa-aaaa', hashes), -1);
  assert.ok(!looksLikeRecovery('123456'));
});
