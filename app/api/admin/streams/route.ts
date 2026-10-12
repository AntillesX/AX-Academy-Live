import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { DEFAULT_TRACKS } from '@/lib/youtube';
export const dynamic = 'force-dynamic';
export async function GET() { const session = await getSession(); if (session?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ streams: DEFAULT_TRACKS, updatedAt: new Date().toISOString() }); }
