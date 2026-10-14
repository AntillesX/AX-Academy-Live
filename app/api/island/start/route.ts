import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bqkupphnnmiyabskybu.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function bearer(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

export async function POST(request: Request) {
  try {
    const token = bearer(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!anonKey || !serviceKey) return NextResponse.json({ error: 'Island sessions are not configured' }, { status: 503 });

    const supabaseUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const sessionId = crypto.randomUUID();
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const simVersion = 'v2.0';
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: dbError } = await supabaseAdmin.from('island_sessions').insert({ id: sessionId, user_id: user.id, seed, sim_version: simVersion, status: 'open' });
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ sessionId, seed, simVersion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
