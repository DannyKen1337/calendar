import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_tavern_2026';
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

export async function verifyAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === 'admin' || session.role === 'owner') {
    return session;
  }
  return null;
}

export async function verifyOwner() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === 'owner') {
    return session;
  }
  return null;
}