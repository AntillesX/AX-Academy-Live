import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'crypto';

export const SESSION_COOKIE = 'antillesx_session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'development-only-change-this-session-secret-32');
export const anonymousUserId = () => randomUUID();

export async function createSessionToken(userId: string, email = '', role = 'student') {
  return new SignJWT({ email, role, dataPolicy: 'anonymous-uuid-only' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('7d').sign(secret());
}

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: String(payload.sub), email: String(payload.email || ''), role: String(payload.role || 'student') };
  } catch { return null; }
}

export function sessionCookieOptions(secure = process.env.NODE_ENV === 'production') {
  return { name: SESSION_COOKIE, httpOnly: true, sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 7 };
}
