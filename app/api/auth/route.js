import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { attachSession, bumpSessionVersion } from '@/lib/auth';
import { isRateLimited, recordAttempt } from '@/lib/rateLimit';
import { passwordProblem } from '@/lib/passwordPolicy';
import { checkSecondFactor } from '@/lib/secondFactor';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Belépési süti (lib/auth.js: attachSession, a munkamenet-verzióval)
async function sessionResponse(user, extra = {}) {
  const response = NextResponse.json({ success: true, user: { username: user.username, role: user.role }, ...extra });
  return attachSession(response, user);
}

// Nem létező felhasználónál is lefut egy bcrypt-összehasonlítás, így a válaszidőből nem derül ki, létezik-e a fiók
const DUMMY_HASH = '$2b$10$QWj414nYgVTFljhEykHJf.n0emBKZ85B1F5P610IAUW3YTykomhfi';
const passwordMatches = (password, user) => bcrypt.compare(password, user?.password || DUMMY_HASH).then(ok => ok && !!user);

// Fiókonként a sikertelen próbálkozások száma is korlátos (sok IP-címről indított jelszópróbálgatás ellen).
// Csak a hibás jelszó számít, a sikeres belépés nem.
const FAIL_LIMIT = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const failKey = (loginId) => `login-fail:${loginId.trim().toLowerCase()}`;

const isTempPasswordExpired = (user) =>
  !!user.tempPasswordExpires && new Date(user.tempPasswordExpires) < new Date();

export async function GET() {
  try {
    const db = await getTavernDb();
    const userCount = await db.collection('users').countDocuments();
    const canRegister =
      userCount === 0 || process.env.ALLOW_PUBLIC_REGISTER === 'true';
    return NextResponse.json({ canRegister });
  } catch {
    return NextResponse.json({ canRegister: false });
  }
}

export async function POST(request) {
  try {
    const { action, loginId, password, email, username, tempPassword, newPassword, code } = await request.json();
    const db = await getTavernDb();

    // --- REGISZTRÁCIÓ ---
    if (action === 'register') {
      if (typeof username !== 'string' || !username.trim() || typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: "Adj meg felhasználónevet, e-mail címet és jelszót!" }, { status: 400 });
      }
      const weak = passwordProblem(password, { username, email });
      if (weak) return NextResponse.json({ error: weak }, { status: 400 });
      const userCount = await db.collection('users').countDocuments();
      const isFirstUser = userCount === 0;
      if (!isFirstUser && process.env.ALLOW_PUBLIC_REGISTER !== 'true') {
        return NextResponse.json({ error: 'A regisztráció le van tiltva.' }, { status: 403 });
      }

      const existingUser = await db.collection('users').findOne({ 
        $or: [{ email: email.toLowerCase() }, { username: username }] 
      });
      if (existingUser) {
        return NextResponse.json({ error: "Ez az e-mail vagy felhasználónév már foglalt!" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.collection('users').insertOne({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? 'owner' : 'customer', // Az első fiók owner, a többi customer
        createdAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    // --- BEJELENTKEZÉS ---
    if (action === 'login') {
      if (typeof loginId !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: "Hiányzó adatok!" }, { status: 400 });
      }
      // Jelszópróbálgatás ellen: IP-címenként korlátozzuk a belépési kísérleteket
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
      const allowed = await consumeRateLimit(db, `login:${ip}`, 20, 15 * 60 * 1000);
      if (!allowed) {
        return NextResponse.json({ error: 'Túl sok belépési kísérlet. Próbáld újra 15 perc múlva.' }, { status: 429 });
      }

      if (await isRateLimited(db, failKey(loginId), FAIL_LIMIT, FAIL_WINDOW_MS)) {
        return NextResponse.json({ error: 'Ezzel a fiókkal túl sok hibás belépés történt. Próbáld újra 15 perc múlva.' }, { status: 429 });
      }

      const user = await db.collection('users').findOne({ 
        $or: [{ email: loginId.toLowerCase() }, { username: loginId }] 
      });

      if (!(await passwordMatches(password, user))) {
        await recordAttempt(db, failKey(loginId));
        return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });
      }
      if (user.disabled) return NextResponse.json({ error: "Ez a fiók fel van függesztve. Keresd a tulajdonost." }, { status: 403 });

      // Ideiglenes jelszóval NEM lehet belépni: csak jelszóbeállításra jogosít (nem készül munkamenet / süti)
      if (user.mustChangePassword) {
        if (isTempPasswordExpired(user)) {
          return NextResponse.json({ error: "Az ideiglenes jelszó lejárt. Kérj újat a tulajdonostól." }, { status: 401 });
        }
        return NextResponse.json({ success: true, mustChangePassword: true });
      }

      // Kétlépcsős azonosítás: a jelszó után a hitelesítő app kódja (vagy egy tartalék kód) is kell
      const second = await checkSecondFactor(db, user, code);
      if (second.needCode) return NextResponse.json({ needCode: true, error: 'Add meg a hitelesítő alkalmazásod 6 jegyű kódját.' }, { status: 401 });
      if (!second.ok) {
        await recordAttempt(db, failKey(loginId));
        return NextResponse.json({ needCode: true, error: 'Hibás vagy már felhasznált kód.' }, { status: 401 });
      }

      await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
      if (!second.usedRecovery) return await sessionResponse(user);
      // tartalék kóddal: a felület figyelmeztet, ha kevés maradt
      await db.collection('audit_logs').insertOne({ adminName: user.username, action: 'KÉTLÉPCSŐS', details: `Tartalék kóddal lépett be (${second.recoveryLeft} maradt).`, date: new Date() });
      return await sessionResponse(user, { recoveryLeft: second.recoveryLeft });
    }

    // --- ELSŐ BELÉPÉS: az ideiglenes jelszó lecserélése saját jelszóra (egyszer használatos) ---
    if (action === 'complete_setup') {
      if (typeof loginId !== 'string' || typeof tempPassword !== 'string' || typeof newPassword !== 'string') {
        return NextResponse.json({ error: "Hiányzó adatok!" }, { status: 400 });
      }

      const allowed = await consumeRateLimit(db, `setup:${loginId.toLowerCase()}`, 10, 60 * 60 * 1000);
      if (!allowed) {
        return NextResponse.json({ error: 'Túl sok kísérlet. Próbáld újra később.' }, { status: 429 });
      }

      const user = await db.collection('users').findOne({
        $or: [{ email: loginId.toLowerCase() }, { username: loginId }]
      });
      const isMatch = await passwordMatches(tempPassword, user);
      if (!isMatch || !user.mustChangePassword) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      if (isTempPasswordExpired(user)) {
        return NextResponse.json({ error: "Az ideiglenes jelszó lejárt. Kérj újat a tulajdonostól." }, { status: 401 });
      }
      const weak = passwordProblem(newPassword, { username: user.username, email: user.email });
      if (weak) return NextResponse.json({ error: weak }, { status: 400 });
      if (newPassword === tempPassword) {
        return NextResponse.json({ error: "Az új jelszó nem egyezhet meg az ideiglenessel." }, { status: 400 });
      }
      // ha a fióknál be van kapcsolva a kétlépcsős azonosítás, itt is kell a kód (az új ideiglenes jelszó azt nem kapcsolja ki)
      const second = await checkSecondFactor(db, user, code);
      if (second.needCode) return NextResponse.json({ needCode: true, error: 'Add meg a hitelesítő alkalmazásod 6 jegyű kódját.' }, { status: 401 });
      if (!second.ok) return NextResponse.json({ needCode: true, error: 'Hibás vagy már felhasznált kód.' }, { status: 401 });
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // A feltétel (mustChangePassword + régi hash) miatt az ideiglenes jelszó pontosan egyszer használható fel, párhuzamos kérésnél is
      const result = await db.collection('users').findOneAndUpdate(
        { _id: user._id, mustChangePassword: true, password: user.password },
        {
          $set: { password: hashedPassword, passwordChangedAt: new Date() },
          $unset: { mustChangePassword: '', tempPasswordExpires: '' },
          ...bumpSessionVersion,
        },
        { returnDocument: 'after' }
      );
      if (!result) {
        return NextResponse.json({ error: "Az ideiglenes jelszó már fel lett használva." }, { status: 409 });
      }

      return await sessionResponse(result);
    }

    return NextResponse.json({ error: "Érvénytelen művelet" }, { status: 400 });
  } catch (error) {
    console.error('auth error:', error);
    await logSystemError('auth', error);
    return NextResponse.json({ error: "Szerverhiba történt." }, { status: 500 });
  }
}
