import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { getCurrentUser, attachSession, bumpSessionVersion } from '@/lib/auth';
import { getTavernDb } from '@/lib/mongodb';
import { logSystemError } from '@/lib/systemLog';
import { consumeRateLimit } from '@/lib/rateLimit';
import { newSecret, otpauthUri, verifyTotp, newRecoveryCodes, hashRecoveryCodes } from '@/lib/totp';
import { checkSecondFactor, hasSecondFactor, secondFactorRecommended } from '@/lib/secondFactor';

export const dynamic = 'force-dynamic';

// Kétlépcsős azonosítás a saját fiókhoz (Továbbiak › Fiók). GET: állapot. POST:
//  - start: új titok (még nem él), QR-kód és kézi kulcs a hitelesítő apphoz
//  - confirm { code }: az app első kódjával bekapcsolja; visszaadja a 10 tartalék kódot (csak ekkor látszanak)
//  - disable { password, code }: kikapcsolás jelszóval és kóddal (vagy tartalék kóddal)
//  - recovery { code }: új tartalék kódok (a régiek érvénytelenek)
// Be- és kikapcsoláskor a többi eszközön kijelentkezik (munkamenet-verzió), ezen az eszközön bent marad.
const PENDING_TTL_MS = 15 * 60 * 1000;
const bad = (error, status = 400) => NextResponse.json({ error }, { status });
const log = (db, user, details) => db.collection('audit_logs').insertOne({ adminName: user.username, action: 'KÉTLÉPCSŐS', details, date: new Date() });

async function loadUser(db, session) {
  return db.collection('users').findOne({ _id: new ObjectId(String(session.id)) });
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return bad('Nincs bejelentkezve.', 401);
  const db = await getTavernDb();
  const user = await loadUser(db, session);
  return NextResponse.json({
    enabled: hasSecondFactor(user),
    enabledAt: user?.totp?.enabledAt || null,
    recoveryLeft: (user?.recoveryCodes || []).length,
    recommended: secondFactorRecommended(session),
  });
}

export async function POST(request) {
  try {
    const session = await getCurrentUser();
    if (!session) return bad('Nincs bejelentkezve.', 401);
    const body = await request.json().catch(() => null);
    const action = body?.action;
    const db = await getTavernDb();
    const users = db.collection('users');
    const user = await loadUser(db, session);
    if (!user) return bad('Nincs bejelentkezve.', 401);
    // kódpróbálgatás ellen: fiókonként 15 percenként legfeljebb 10 kísérlet
    const limited = async () => !(await consumeRateLimit(db, `2fa:${user._id}`, 10, 15 * 60 * 1000));

    if (action === 'start') {
      if (hasSecondFactor(user)) return bad('A kétlépcsős azonosítás már be van kapcsolva.');
      const secret = newSecret();
      await users.updateOne({ _id: user._id }, { $set: { totpPending: { secret, at: new Date() } } });
      const uri = otpauthUri(secret, user.username);
      const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      return NextResponse.json({ qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, secret: secret.match(/.{1,4}/g).join(' '), uri });
    }

    if (action === 'confirm') {
      if (hasSecondFactor(user)) return bad('A kétlépcsős azonosítás már be van kapcsolva.');
      const pending = user.totpPending;
      if (!pending?.secret || Date.now() - new Date(pending.at).getTime() > PENDING_TTL_MS) return bad('A beállítás lejárt. Kezdd újra.');
      if (await limited()) return bad('Túl sok próbálkozás. Próbáld újra 15 perc múlva.', 429);
      const step = verifyTotp(pending.secret, body?.code);
      if (step == null) return bad('Hibás kód. Írd be az alkalmazásban most látható 6 számjegyet.');
      const codes = newRecoveryCodes();
      const updated = await users.findOneAndUpdate(
        { _id: user._id, 'totpPending.secret': pending.secret },
        { $set: { totp: { secret: pending.secret, enabledAt: new Date(), lastStep: step }, recoveryCodes: await hashRecoveryCodes(codes) }, $unset: { totpPending: '' }, ...bumpSessionVersion },
        { returnDocument: 'after' },
      );
      if (!updated) return bad('A beállítás közben megváltozott. Kezdd újra.', 409);
      await log(db, user, 'Bekapcsolta a kétlépcsős azonosítást.');
      return attachSession(NextResponse.json({ success: true, recoveryCodes: codes }), updated);
    }

    if (action === 'disable') {
      if (!hasSecondFactor(user)) return bad('A kétlépcsős azonosítás nincs bekapcsolva.');
      if (await limited()) return bad('Túl sok próbálkozás. Próbáld újra 15 perc múlva.', 429);
      if (typeof body?.password !== 'string' || !(await bcrypt.compare(body.password, user.password))) return bad('Hibás jelszó.');
      const second = await checkSecondFactor(db, user, body?.code);
      if (!second.ok) return bad('Hibás vagy már felhasznált kód.');
      const updated = await users.findOneAndUpdate({ _id: user._id }, { $unset: { totp: '', recoveryCodes: '', totpPending: '' }, ...bumpSessionVersion }, { returnDocument: 'after' });
      await log(db, user, 'Kikapcsolta a kétlépcsős azonosítást.');
      return attachSession(NextResponse.json({ success: true }), updated);
    }

    if (action === 'recovery') {
      if (!hasSecondFactor(user)) return bad('A kétlépcsős azonosítás nincs bekapcsolva.');
      if (await limited()) return bad('Túl sok próbálkozás. Próbáld újra 15 perc múlva.', 429);
      const second = await checkSecondFactor(db, user, body?.code);
      if (!second.ok) return bad('Hibás vagy már felhasznált kód.');
      const codes = newRecoveryCodes();
      await users.updateOne({ _id: user._id }, { $set: { recoveryCodes: await hashRecoveryCodes(codes) } });
      await log(db, user, 'Új tartalék kódokat kért.');
      return NextResponse.json({ success: true, recoveryCodes: codes });
    }

    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('2fa error:', error);
    await logSystemError('2fa', error);
    return bad('Szerverhiba történt.', 500);
  }
}
