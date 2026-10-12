import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
export const MAX_SCORE = 100000;
export function newArcadeSession(gameName: string) { return { sessionId: randomUUID(), gameName: gameName.trim(), startedAt: new Date().toISOString() }; }
export async function recordArcadeScore(userId: string, gameName: string, score: number) { const safeScore = Math.min(Math.max(Math.floor(score), 0), MAX_SCORE); const xp = Math.min(Math.floor(safeScore / 10), 500); const { data, error } = await supabaseAdmin.rpc('record_arcade_score', { p_user_id: userId, p_game_name: gameName, p_score: safeScore, p_xp_earned: xp }); if (error) throw error; return { data, xp }; }
