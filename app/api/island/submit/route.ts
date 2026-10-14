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

    const body = await request.json().catch(() => null) as { sessionId?: unknown; actions?: unknown; endTick?: unknown; finalScore?: unknown } | null;
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    const actions = Array.isArray(body?.actions) ? body.actions : null;
    const endTick = typeof body?.endTick === 'number' ? Math.floor(body.endTick) : -1;
    const finalScore = typeof body?.finalScore === 'number' ? Math.floor(body.finalScore) : 0;
    if (!sessionId || !actions || endTick < 0 || finalScore < 0) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: session } = await supabaseAdmin.from('island_sessions').select('id').eq('id', sessionId).eq('user_id', user.id).eq('status', 'open').single();
    if (!session) return NextResponse.json({ error: 'Session not found or closed' }, { status: 400 });

    const antxAwarded = Math.min(5, Math.floor(finalScore / 200));
    const xpAwarded = Math.min(100, Math.floor(finalScore / 10));
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('award_island_run', { p_session_id: sessionId, p_user_id: user.id, p_antx: antxAwarded, p_xp: xpAwarded, p_score: finalScore, p_ticks: endTick });
    if (rpcError || !rpcData) return NextResponse.json({ error: rpcError?.message || 'Award failed' }, { status: 500 });

    return NextResponse.json({ success: true, antxAwarded, xpAwarded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
