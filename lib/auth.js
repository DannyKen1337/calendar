import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getTavernDb } from '@/lib/mongodb';

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return new TextEncoder().encode('dev_only_jwt_secret_not_for_production');
  }
  return new TextEncoder().encode(secret);
};

export async function encrypt(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(getSecretKey());
}

export async function decrypt(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (err) {
    return null;
  }
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('tavern_session')?.value;
    if (!token) return null;
    return await decrypt(token);
  } catch (e) {
    return null;
  }
}

// A szerepet mindig az adatbázisból olvassuk: a süti 14 napig érvényes, de egy törölt vagy
// visszafokozott fiók ne tarthassa meg addig a jogosultságait.
async function sessionWithCurrentRole() {
  const session = await getSession();
  if (!session?.id) return null;
  try {
    const db = await getTavernDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(String(session.id)) }, { projection: { role: 1 } });
    if (!user) return null;
    return { ...session, role: user.role };
  } catch {
    return null;
  }
}

export async function verifyAdmin() {
  const session = await sessionWithCurrentRole();
  if (session && (session.role === 'admin' || session.role === 'owner')) return session;
  return null;
}

export async function verifyOwner() {
  const session = await sessionWithCurrentRole();
  if (session && session.role === 'owner') return session;
  return null;
}