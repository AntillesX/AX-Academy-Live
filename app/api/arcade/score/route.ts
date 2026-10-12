import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { recordArcadeScore } from '@/lib/arcade';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); const session = await getSession(); if (!session?.userId) return NextResponse.json({ error: 'Sign in is required before recording a score.' }, { status: 401 }); if (typeof body.gameName !== 'string' || typeof body.score !== 'number') return NextResponse.json({ error: 'Game name and score are required.' }, { status: 400 }); try { return NextResponse.json(await recordArcadeScore(session.userId, body.gameName, body.score)); } catch { return NextResponse.json({ error: 'Score validation failed.' }, { status: 422 }); } }
