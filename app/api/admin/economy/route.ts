import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { ECONOMY_POLICY, MAX_MILESTONE_REWARD } from '@/lib/economy';
export async function POST() { const session = await getSession(); if (session?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); return NextResponse.json({ policy: ECONOMY_POLICY, maxMilestoneReward: MAX_MILESTONE_REWARD }); }
