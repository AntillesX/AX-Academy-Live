import { supabaseAdmin } from './supabase-admin';
export const rpName = 'AntillesX';
export const rpID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost';
export const origin = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN || 'http://localhost:3000';
export async function saveChallenge(challenge: string, email: string, purpose: 'registration' | 'authentication') {
  await supabaseAdmin.from('passkey_challenges').delete().eq('email', email).eq('purpose', purpose);
  const { error } = await supabaseAdmin.from('passkey_challenges').insert({ challenge, email: email.toLowerCase(), purpose, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
  if (error) throw error;
}
export async function consumeChallenge(email: string, purpose: 'registration' | 'authentication') {
  const { data } = await supabaseAdmin.from('passkey_challenges').select('*').eq('email', email.toLowerCase()).eq('purpose', purpose).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (data) await supabaseAdmin.from('passkey_challenges').delete().eq('id', data.id);
  return data?.challenge as string | undefined;
}
