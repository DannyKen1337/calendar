import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET;
if (!secretKey) throw new Error("A JWT_SECRET hiányzik a .env fájlból!");

const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d') // 14 napig érvényes a bejelentkezés
    .sign(key);
}

export async function decrypt(input) {
  try {
    const { payload } = await jwtVerify(input, key, { algorithms: ['HS256'] });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function getSession() {
  const session = cookies().get('tavern_session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

// Szerveroldali admin ellenőrző API végpontokhoz
export async function verifyAdmin() {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'owner')) {
    return null;
  }
  return session;
}

export async function verifyOwner() {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return null;
  }
  return session;
}