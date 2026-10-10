import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { env } from '@/lib/env';
import { getSession } from '@/lib/session';
import { rpID, rpName, saveChallenge } from '@/lib/passkey';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    const session = await getSession();
    const authorized = session?.email.toLowerCase() === normalized || (!!env.PASSKEY_ENROLLMENT_SECRET && request.headers.get('x-passkey-enrollment-secret') === env.PASSKEY_ENROLLMENT_SECRET);
    if (!authorized) return NextResponse.json({ error: 'Existing session or enrollment secret required' }, { status: 401 });

    let { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let user = users?.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (!user) {
      const created = await supabaseAdmin.auth.admin.createUser({ email: normalized, email_confirm: true });
      if (created.error || !created.data.user) throw created.error || new Error('Could not provision user');
      user = created.data.user;
    }
    await supabaseAdmin.from('profiles').upsert({ id: user.id, email: normalized, role: normalized === 'antillesacademy@protonmail.com' ? 'admin' : 'student' }, { onConflict: 'id' });
    const { data: existing } = await supabaseAdmin.from('passkeys').select('credential_id, transports').eq('user_id', user.id);
    const options = await generateRegistrationOptions({ rpName, rpID, userName: normalized, userDisplayName: normalized, userID: new TextEncoder().encode(user.id), attestationType: 'none', excludeCredentials: (existing || []).map((key) => ({ id: key.credential_id, transports: key.transports as AuthenticatorTransport[] })) });
    await saveChallenge(options.challenge, normalized, 'registration');
    return NextResponse.json(options);
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Unable to create registration options' }, { status: 500 }); }
}
