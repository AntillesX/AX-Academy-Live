import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { env } from '@/lib/env';
import { getSession } from '@/lib/session';
import { consumeChallenge, origin, rpID } from '@/lib/passkey';
export async function POST(request: NextRequest) {
  try {
    const { email, response } = await request.json() as { email?: string; response?: Parameters<typeof verifyRegistrationResponse>[0]['response'] };
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !response) return NextResponse.json({ error: 'Email and credential are required' }, { status: 400 });
    const session = await getSession();
    const authorized = session?.email.toLowerCase() === normalized || (!!env.PASSKEY_ENROLLMENT_SECRET && request.headers.get('x-passkey-enrollment-secret') === env.PASSKEY_ENROLLMENT_SECRET);
    if (!authorized) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    const expectedChallenge = await consumeChallenge(normalized, 'registration');
    if (!expectedChallenge) return NextResponse.json({ error: 'Registration challenge expired' }, { status: 400 });
    const verification = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ error: 'Registration was not verified' }, { status: 400 });
    const { data: user } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const account = user.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const { credential } = verification.registrationInfo;
    const { error } = await supabaseAdmin.from('passkeys').insert({ user_id: account.id, credential_id: credential.id, public_key: Buffer.from(credential.publicKey), counter: credential.counter, transports: credential.transports || [] });
    if (error) return NextResponse.json({ error: 'Credential could not be stored' }, { status: 409 });
    return NextResponse.json({ verified: true });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 }); }
}
