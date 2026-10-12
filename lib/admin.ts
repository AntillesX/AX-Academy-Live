import { getSession } from './session';
export async function requireAdmin() {
  const session = await getSession();
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!session || session.role !== 'admin' || !configuredAdminEmail || session.email.toLowerCase() !== configuredAdminEmail) throw new Error('Admin access required');
  return session;
}
