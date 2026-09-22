import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { action, loginId, password, email, username } = await request.json();
    const client = await clientPromise;
    const db = client.db();

    if (action === 'register') {
      const existingUser = await db.collection('users').findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
      if (existingUser) return NextResponse.json({ error: "Ez az e-mail vagy felhasználónév már foglalt!" }, { status: 400 });

      const hashedPassword = await bcrypt.hash(password, 10);
      const isFirstUser = (await db.collection('users').countDocuments()) === 0;

      await db.collection('users').insertOne({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? 'owner' : 'customer',
        createdAt: new Date()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'login') {
      const user = await db.collection('users').findOne({ 
        $or: [{ email: loginId.toLowerCase() }, { username: loginId }] 
      });

      if (!user) return NextResponse.json({ error: "Hibás bejelentkezési adatok!" }, { status: 401 });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return NextResponse.json({ error: "Hibás bejelentkezési adatok!" }, { status: 401 });

      // JWT Token generálása
      const sessionData = { 
        id: user._id.toString(), 
        username: user.username, 
        email: user.email, 
        role: user.role 
      };
      
      const session = await encrypt(sessionData);

      // HttpOnly cookie beállítása (biztonságos!)
      cookies().set('tavern_session', session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 14 // 14 nap
      });

      return NextResponse.json({ 
        success: true, 
        user: { username: user.username, email: user.email, role: user.role } 
      });
    }

    return NextResponse.json({ error: "Ismeretlen művelet" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Szerver hiba" }, { status: 500 });
  }
}