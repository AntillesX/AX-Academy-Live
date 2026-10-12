export const ECONOMY_POLICY = { currency: 'AntX', convertible: false, cashValue: false, speculative: false, source: 'academic-and-focus-milestones' } as const;
export const MAX_MILESTONE_REWARD = 500;
export function milestoneReward(score: number) { return Math.min(Math.max(Math.floor(score / 10), 0), MAX_MILESTONE_REWARD); }
export function safeBalance(value: number) { return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)); }
