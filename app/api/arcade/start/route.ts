import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { newArcadeSession } from '@/lib/arcade';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); const gameName = typeof body.gameName === 'string' ? body.gameName.trim() : ''; if (!gameName || gameName.length > 80) return NextResponse.json({ error: 'A valid game name is required.' }, { status: 400 }); const session = await getSession(); return NextResponse.json({ ...newArcadeSession(gameName), userId: session?.userId || null, mode: session ? 'authenticated' : 'demo' }); }
