export const TICK = 1 / 60;
export type CargoType = 'food' | 'medical' | 'solar' | 'water';
export type Phase = 'title' | 'playing' | 'won' | 'lost';
export interface Cargo { id: number; type: CargoType; x: number; delivered: boolean; selected: boolean; }
export interface State { phase: Phase; time: number; score: number; fuel: number; integrity: number; delivered: number; target: number; lane: number; cargo: Cargo[]; toast: string; }
export interface Input { move: -1 | 0 | 1; load: boolean; deliver: boolean; }
export const EMPTY_INPUT: Input = { move: 0, load: false, deliver: false };
const TYPES: CargoType[] = ['food', 'medical', 'solar', 'water'];
export function createGame(): State { return { phase: 'title', time: 0, score: 0, fuel: 100, integrity: 100, delivered: 0, target: 8, lane: 1, cargo: [], toast: 'Route essential cargo through East Port.' }; }
export function startGame(s: State) { Object.assign(s, createGame(), { phase: 'playing' }); for (let i = 0; i < 12; i++) s.cargo.push({ id: i, type: TYPES[i % TYPES.length], x: 16 + (i % 6) * 13, delivered: false, selected: false }); }
export function step(s: State, input: Input, dt: number) { if (s.phase !== 'playing') return; s.time += dt; s.fuel = Math.max(0, s.fuel - dt * .8); if (input.move) s.lane = Math.max(0, Math.min(2, s.lane + input.move)); if (input.load) { const next = s.cargo.find(c => !c.delivered && !c.selected); if (next) { next.selected = true; s.toast = `Loaded ${next.type} cargo`; } } if (input.deliver) { const next = s.cargo.find(c => c.selected && !c.delivered); if (next) { next.selected = false; next.delivered = true; s.delivered++; s.score += 125; s.toast = `${next.type.toUpperCase()} delivery confirmed`; } } if (s.fuel <= 0) { s.phase = 'lost'; s.toast = 'Fuel reserve depleted. Re-route and try again.'; } else if (s.delivered >= s.target) { s.phase = 'won'; s.toast = 'East Port logistics chain stabilised.'; } }
export function snapshot(s: State) { return { phase: s.phase, time: Math.ceil(s.time), score: s.score, fuel: Math.round(s.fuel), integrity: s.integrity, delivered: s.delivered, target: s.target, lane: s.lane, toast: s.toast }; }
