import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    const { action, loginId, password, email, username } = await request.json();
    const db = await getTavernDb();

    // --- REGISZTRÁCIÓ ---
    if (action === 'register') {
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
      const user = await db.collection('users').findOne({ 
        $or: [{ email: loginId.toLowerCase() }, { username: loginId }] 
      });

      if (!user) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return NextResponse.json({ error: "Hibás adatok!" }, { status: 401 });

      const sessionToken = await encrypt({ 
        id: user._id.toString(), 
        username: user.username, 
        email: user.email, 
        role: user.role 
      });

      const response = NextResponse.json({ success: true, user: { username: user.username, role: user.role } });
      
      // A süti stabil beállítása a NextResponse-on keresztül!
      response.cookies.set('tavern_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 14 // 14 napig érvényes
      });

      return response;
    }

    return NextResponse.json({ error: "Érvénytelen művelet" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Szerverhiba történt." }, { status: 500 });
  }
}