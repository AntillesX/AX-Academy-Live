'use client';
import { create } from 'zustand';
export type BuffetSession = { id: string; score: number; combo: number; selectedFood: string | null; servedCount: number; status: 'idle' | 'playing' | 'complete'; updatedAt: string };
export type BeachBuffetRenderStore = BuffetSession & { connection: 'offline' | 'connecting' | 'realtime'; applySession: (session: Partial<BuffetSession>) => void; setConnection: (connection: BeachBuffetRenderStore['connection']) => void; reset: (id?: string) => void };
const initial = (id = ''): BuffetSession => ({ id, score: 0, combo: 0, selectedFood: null, servedCount: 0, status: 'idle', updatedAt: new Date(0).toISOString() });
export const useBeachBuffetRenderStore = create<BeachBuffetRenderStore>((set) => ({ ...initial(), connection: 'offline', applySession: (session) => set((current) => ({ ...current, ...session, updatedAt: session.updatedAt || new Date().toISOString() })), setConnection: (connection) => set({ connection }), reset: (id = '') => set({ ...initial(id), connection: 'offline' }) }));
