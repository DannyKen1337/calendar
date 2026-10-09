import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Belépési süti beállítása a NextResponse-on keresztül (egy helyen, hogy a belépés és a jelszóbeállítás ugyanazt használja)
async function sessionResponse(user) {
  const sessionToken = await encrypt({
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role
  });

  const response = NextResponse.json({ success: true, user: { username: user.username, role: user.role } });

  response.cookies.set('tavern_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14 // 14 napig érvényes
  });

  return response;
}

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
    const { action, loginId, password, email, username, tempPassword, newPassword } = await request.json();
    const db = await getTavernDb();

    // --- REGISZTRÁCIÓ ---
    if (action === 'register') {
      if (typeof username !== 'string' || !username.trim() || typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
        return NextResponse.json({ error: "Adj meg felhasználónevet, e-mail címet és legalább 8 karakteres jelszót!" }, { status: 400 });
      }
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

      const user = await db.collection('users').findOne({ 
        $or: [{ email: loginId.toLowerCase() }, { username: loginId }] 
      });

      if (!user) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      // Ideiglenes jelszóval NEM lehet belépni: csak jelszóbeállításra jogosít (nem készül munkamenet / süti)
      if (user.mustChangePassword) {
        if (isTempPasswordExpired(user)) {
          return NextResponse.json({ error: "Az ideiglenes jelszó lejárt. Kérj újat a tulajdonostól." }, { status: 401 });
        }
        return NextResponse.json({ success: true, mustChangePassword: true });
      }

      return await sessionResponse(user);
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
      if (!user || !user.mustChangePassword) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      const isMatch = await bcrypt.compare(tempPassword, user.password);
      if (!isMatch) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      if (isTempPasswordExpired(user)) {
        return NextResponse.json({ error: "Az ideiglenes jelszó lejárt. Kérj újat a tulajdonostól." }, { status: 401 });
      }
      if (newPassword.length < 8 || newPassword.length > 72) {
        return NextResponse.json({ error: "Az új jelszó 8 és 72 karakter közötti legyen." }, { status: 400 });
      }
      if (newPassword === tempPassword) {
        return NextResponse.json({ error: "Az új jelszó nem egyezhet meg az ideiglenessel." }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // A feltétel (mustChangePassword + régi hash) miatt az ideiglenes jelszó pontosan egyszer használható fel, párhuzamos kérésnél is
      const result = await db.collection('users').updateOne(
        { _id: user._id, mustChangePassword: true, password: user.password },
        {
          $set: { password: hashedPassword, passwordChangedAt: new Date() },
          $unset: { mustChangePassword: '', tempPasswordExpires: '' }
        }
      );
      if (result.modifiedCount !== 1) {
        return NextResponse.json({ error: "Az ideiglenes jelszó már fel lett használva." }, { status: 409 });
      }

      return await sessionResponse(user);
    }

    return NextResponse.json({ error: "Érvénytelen művelet" }, { status: 400 });
  } catch (error) {
    console.error('auth error:', error);
    return NextResponse.json({ error: "Szerverhiba történt." }, { status: 500 });
  }
}
