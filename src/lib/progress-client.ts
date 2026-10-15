export type ProgressPatch = { subjectCode?: string; topicId?: string; quizScore?: number; badge?: string; game?: string; gameCoins?: number };
const KEY = 'ax-academy-progress-v1';
export type LocalProgress = { quizScores: Record<string, number>; badges: string[]; gameCoins: Record<string, number> };
export const emptyProgress = (): LocalProgress => ({ quizScores: {}, badges: [], gameCoins: {} });
export function readLocalProgress(): LocalProgress { if (typeof window === 'undefined') return emptyProgress(); try { const parsed = JSON.parse(localStorage.getItem(KEY) || '{}'); return { quizScores: parsed.quizScores || {}, badges: Array.isArray(parsed.badges) ? parsed.badges : [], gameCoins: parsed.gameCoins || {} }; } catch { return emptyProgress(); } }
export async function syncProgress(patch: ProgressPatch): Promise<LocalProgress> {
  const current = readLocalProgress();
  if (patch.topicId && typeof patch.quizScore === 'number') current.quizScores[patch.topicId] = Math.max(current.quizScores[patch.topicId] || 0, patch.quizScore);
  if (patch.badge && !current.badges.includes(patch.badge)) current.badges.push(patch.badge);
  if (patch.game && typeof patch.gameCoins === 'number') current.gameCoins[patch.game] = Math.max(current.gameCoins[patch.game] || 0, patch.gameCoins);
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* local persistence is best effort */ }
  try { await fetch('/api/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }); } catch { /* the local fallback remains authoritative offline */ }
  return current;
}
export async function loadProgress(): Promise<LocalProgress> { const local = readLocalProgress(); try { const response = await fetch('/api/progress'); if (!response.ok) return local; const data = await response.json(); const remote = data.progress || {}; const merged: LocalProgress = { quizScores: { ...local.quizScores, ...(remote.quiz_scores || {}) }, badges: Array.from(new Set([...local.badges, ...(Array.isArray(remote.badges) ? remote.badges : [])])), gameCoins: { ...local.gameCoins, ...(remote.game_coins || {}) } }; try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* ignore storage restrictions */ } return merged; } catch { return local; } }
