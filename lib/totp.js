// Kétlépcsős azonosítás: időalapú egyszeri kód (TOTP, RFC 6238: HMAC-SHA1, 30 másodperc, 6 számjegy), amit a
// Google Authenticator, a Microsoft Authenticator, az 1Password stb. mutat. Csak szerveroldalon.
// A titok base32 (20 bájt). Ellenőrzéskor ±1 lépés (±30 mp) eltérés megengedett az órák elcsúszása miatt; ugyanaz a
// kód (lépés) kétszer nem használható fel (lastStep). Tartalék kódok: 10 db, egyszer használhatók, bcrypt-tel tárolva.
import { createHmac, randomBytes, randomInt } from 'crypto';
import bcrypt from 'bcryptjs';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP = 30;
export const ISSUER = 'Tavern Admin';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('hibás base32');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));

export function hotp(secret, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  const bin = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_STEP);
export const totpCode = (secret, now = Date.now()) => hotp(secret, currentStep(now));

// A kódhoz tartozó lépés (ha érvényes és még nem használták fel), különben null
export function verifyTotp(secret, code, { now = Date.now(), lastStep = -1, window = 1 } = {}) {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return null;
  const step = currentStep(now);
  for (let d = -window; d <= window; d++) {
    const s = step + d;
    if (s > lastStep && hotp(secret, s) === c) return s;
  }
  return null;
}

// otpauth:// cím a QR-kódhoz (a fiók neve a felhasználónév)
export function otpauthUri(secret, account) {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=${TOTP_STEP}`;
}

// Tartalék kódok: "abcd-efgh" formában (könnyen olvasható betűk és számok, összetéveszthetők nélkül)
const RC = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newRecoveryCodes(n = 10) {
  return Array.from({ length: n }, () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += RC[randomInt(RC.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const normalizeRecovery = (code) => String(code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const looksLikeRecovery = (code) => /^[a-z0-9]{8}$/.test(normalizeRecovery(code)) && !/^\d+$/.test(normalizeRecovery(code));
export const hashRecoveryCodes = (codes) => Promise.all(codes.map(c => bcrypt.hash(normalizeRecovery(c), 10)));

// A megadott tartalék kód melyik tárolt hash-sel egyezik (index), vagy -1
export async function matchRecoveryCode(code, hashes = []) {
  const norm = normalizeRecovery(code);
  if (norm.length !== 8) return -1;
  for (let i = 0; i < hashes.length; i++) if (await bcrypt.compare(norm, hashes[i])) return i;
  return -1;
}
