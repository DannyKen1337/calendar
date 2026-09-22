import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/auth';

export async function POST(request) {
  try {
    const { action, loginId, password, email, username } = await request.json();
    const client = await clientPromise;
    // Célzottan a Tavern_DB-t használjuk, hogy biztosan jó helyre kerüljön az user
    const db = client.db('Tavern'); 

    // --- REGISZTRÁCIÓ ---
    if (action === 'register') {
      const existingUser = await db.collection('users').findOne({ 
        $or: [{ email: email.toLowerCase() }, { username: username }] 
      });
      if (existingUser) {
        return NextResponse.json({ error: "Ez az e-mail vagy felhasználónév már foglalt!" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const isFirstUser = (await db.collection('users').countDocuments()) === 0;

      await db.collection('users').insertOne({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? 'owner' : 'admin', // Az első fiók owner, a többi admin
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