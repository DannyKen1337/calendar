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

export async function verifyAdmin() {
  try {
    const cookieStore = await cookies(); // Biztosíték az újabb Next.js verziókhoz
    const token = cookieStore.get('tavern_session')?.value;
    if (!token) return null;
    
    const verified = await decrypt(token);
    return verified;
  } catch (e) {
    return null;
  }
}