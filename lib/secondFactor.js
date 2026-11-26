// A belépés második lépése (lib/totp.js): ha a fióknál be van kapcsolva a kétlépcsős azonosítás, a jelszó után a
// hitelesítő app 6 jegyű kódja vagy egy tartalék kód is kell. A kód csak egyszer használható (párhuzamos kérésnél is:
// a felhasznált lépést / tartalék kódot feltételes frissítés rögzíti).
import { verifyTotp, looksLikeRecovery, matchRecoveryCode } from '@/lib/totp';

export const hasSecondFactor = (user) => !!user?.totp?.secret;

// Kinek ajánlott kiemelten: a tulajdonosnak, és aki személyes adatokat (2. szint), a postafiókot vagy a felhasználókat kezeli
export const secondFactorRecommended = (user) => user?.role === 'owner'
  || ['personalData', 'mailbox', 'users'].some(f => (user?.features || []).includes(f));

// { ok: true, usedRecovery?, recoveryLeft? } | { ok: false, needCode: true } | { ok: false }
export async function checkSecondFactor(db, user, code) {
  if (!hasSecondFactor(user)) return { ok: true };
  if (code == null || String(code).trim() === '') return { ok: false, needCode: true };
  const users = db.collection('users');
  if (looksLikeRecovery(code)) {
    const hashes = user.recoveryCodes || [];
    const idx = await matchRecoveryCode(code, hashes);
    if (idx < 0) return { ok: false };
    const remaining = hashes.filter((_, i) => i !== idx);
    const res = await users.updateOne({ _id: user._id, recoveryCodes: hashes }, { $set: { recoveryCodes: remaining } });
    return res.modifiedCount === 1 ? { ok: true, usedRecovery: true, recoveryLeft: remaining.length } : { ok: false };
  }
  const lastStep = Number.isInteger(user.totp.lastStep) ? user.totp.lastStep : -1;
  const step = verifyTotp(user.totp.secret, code, { lastStep });
  if (step == null) return { ok: false };
  const res = await users.updateOne(
    { _id: user._id, 'totp.secret': user.totp.secret, $or: [{ 'totp.lastStep': { $lt: step } }, { 'totp.lastStep': { $exists: false } }] },
    { $set: { 'totp.lastStep': step } },
  );
  return res.modifiedCount === 1 ? { ok: true } : { ok: false };
}
