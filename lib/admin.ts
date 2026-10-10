import { getSession } from './session';
export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin' || session.email.toLowerCase() !== 'antillesacademy@protonmail.com') throw new Error('Admin access required');
  return session;
}
