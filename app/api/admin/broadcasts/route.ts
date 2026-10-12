import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
let currentBroadcast: { message: string; updatedAt: string } | null = null;
export async function GET() { return NextResponse.json({ broadcast: currentBroadcast }); }
export async function POST(request: Request) { const session = await getSession(); if (session?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json().catch(() => ({})); const message = typeof body.message === 'string' ? body.message.trim().slice(0, 240) : ''; currentBroadcast = message ? { message, updatedAt: new Date().toISOString() } : null; return NextResponse.json({ broadcast: currentBroadcast }); }
