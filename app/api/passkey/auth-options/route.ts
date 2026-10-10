import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rpID, saveChallenge } from '@/lib/passkey';
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', normalized).maybeSingle();
    if (!profile) return NextResponse.json({ error: 'No AntillesX profile found' }, { status: 404 });
    const { data: keys } = await supabaseAdmin.from('passkeys').select('credential_id, transports').eq('user_id', profile.id);
    if (!keys?.length) return NextResponse.json({ error: 'No passkey enrolled for this account' }, { status: 404 });
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: keys.map((key) => ({ id: key.credential_id, transports: key.transports as AuthenticatorTransport[] })) });
    await saveChallenge(options.challenge, normalized, 'authentication');
    return NextResponse.json(options);
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Unable to create authentication options' }, { status: 500 }); }
}
