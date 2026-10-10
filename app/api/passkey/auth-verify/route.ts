import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { consumeChallenge, origin, rpID } from '@/lib/passkey';
import { createSessionToken, sessionCookieOptions } from '@/lib/session';
export async function POST(request: NextRequest) {
  try {
    const { email, response } = await request.json() as { email?: string; response?: any };
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !response?.id) return NextResponse.json({ error: 'Email and assertion are required' }, { status: 400 });
    const expectedChallenge = await consumeChallenge(normalized, 'authentication');
    if (!expectedChallenge) return NextResponse.json({ error: 'Authentication challenge expired' }, { status: 400 });
    const { data: profile } = await supabaseAdmin.from('profiles').select('id, email, role').eq('email', normalized).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const { data: passkey } = await supabaseAdmin.from('passkeys').select('*').eq('user_id', profile.id).eq('credential_id', response.id).single();
    if (!passkey) return NextResponse.json({ error: 'Credential not recognized' }, { status: 401 });
    const verification = await verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, credential: { id: passkey.credential_id, publicKey: new Uint8Array(passkey.public_key), counter: Number(passkey.counter), transports: passkey.transports as AuthenticatorTransport[] }, requireUserVerification: true });
    if (!verification.verified) return NextResponse.json({ error: 'Biometric verification failed' }, { status: 401 });
    await supabaseAdmin.from('passkeys').update({ counter: verification.authenticationInfo.newCounter }).eq('id', passkey.id);
    const token = await createSessionToken(profile.id, profile.email, profile.role);
    const secure = request.headers.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production';
    const responseOut = NextResponse.json({ verified: true });
    responseOut.cookies.set({ ...sessionCookieOptions(secure), value: token });
    return responseOut;
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Authentication verification failed' }, { status: 400 }); }
}
