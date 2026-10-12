import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
export async function POST(request: Request) { const session = await getSession(); if (session?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json().catch(() => ({})); return NextResponse.json({ ok: true, action: body.action || 'status', message: 'Deployment hook acknowledged; use your CI provider for release execution.' }); }
