
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { action, username, email, password, loginId } = await request.json();
    const client = await clientPromise;
    const db = client.db('Tavern_DB');;

    if (action === 'register') {
      const existingUser = await db.collection('users').findOne({ $or: [{ email }, { username }] });
      if (existingUser) return NextResponse.json({ error: "Email vagy felhasználónév már foglalt!" }, { status: 400 });
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = { username, email, password: hashedPassword, role: 'customer', created_at: new Date() };
      await db.collection('users').insertOne(newUser);
      return NextResponse.json({ success: true, user: { username: newUser.username, email: newUser.email, role: newUser.role } });
    } 
    
    if (action === 'login') {
      const user = await db.collection('users').findOne({ $or: [{ email: loginId }, { username: loginId }] });
      if (!user) return NextResponse.json({ error: "Hibás adatok!" }, { status: 400 });
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return NextResponse.json({ error: "Hibás adatok!" }, { status: 400 });
      return NextResponse.json({ success: true, user: { username: user.username, email: user.email, role: user.role } });
    }
  } catch (error) {
    return NextResponse.json({ error: "Szerver hiba" }, { status: 500 });
  }
}
