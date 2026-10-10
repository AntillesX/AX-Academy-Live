import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { env } from './env';
export const SESSION_COOKIE = 'antillesx_session';
const key = new TextEncoder().encode(env.SESSION_SECRET);
export async function createSessionToken(userId: string, email: string, role: string) {
  return new SignJWT({ email, role }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('7d').sign(key);
}
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, key); return { userId: payload.sub as string, email: payload.email as string, role: payload.role as string }; } catch { return null; }
}
export function sessionCookieOptions(secure: boolean) {
  return { name: SESSION_COOKIE, httpOnly: true, sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 7 };
}
