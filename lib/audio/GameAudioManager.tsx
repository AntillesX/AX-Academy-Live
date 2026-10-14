'use client';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface GameAudioEntry { youtubeUrl: string; volume: number }
export type GameAudioConfig = Record<string, GameAudioEntry>;
export const DEFAULT_VOLUME = 30;
const CONFIG_KEY = 'ax.audio.config.v1';
const UNMUTED_KEY = 'ax.audio.unmuted.v1';
const YT_ID = /^[\w-]{11}$/;

export function extractYouTubeId(input: string): string | null {
  const raw = (input || '').trim();
  if (YT_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return YT_ID.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') { const id = url.searchParams.get('v'); return id && YT_ID.test(id) ? id : null; }
      return url.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/)?.[2] || null;
    }
  } catch { /* invalid URL */ }
  return null;
}
function readJson<T>(key: string): T | null { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; } }
function writeJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
const clampVolume = (value: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : DEFAULT_VOLUME)));
interface AudioContextValue { config: GameAudioConfig; activeGameId: string | null; setActiveGame: (id: string | null) => void; hasAudio: (id: string) => boolean; isMuted: (id: string) => boolean; toggleMute: (id: string) => void; upsertEntry: (id: string, entry: { youtubeUrl: string; volume?: number }) => void; setVolume: (id: string, volume: number) => void; removeEntry: (id: string) => void }
const Context = createContext<AudioContextValue | null>(null);
export function useGameAudio() { const value = useContext(Context); if (!value) throw new Error('useGameAudio must be used inside GameAudioProvider'); return value; }

export function GameAudioProvider({ children, initialConfig = {} }: { children: React.ReactNode; initialConfig?: GameAudioConfig }) {
  const [config, setConfig] = useState<GameAudioConfig>(initialConfig);
  const [unmuted, setUnmuted] = useState<Set<string>>(() => new Set());
  const [activeGameId, setActiveGame] = useState<string | null>(null);
  useEffect(() => { const saved = readJson<GameAudioConfig>(CONFIG_KEY); if (saved) setConfig(prev => ({ ...prev, ...saved })); const savedUnmuted = readJson<string[]>(UNMUTED_KEY); if (savedUnmuted) setUnmuted(new Set(savedUnmuted)); }, []);
  useEffect(() => { writeJson(CONFIG_KEY, config); }, [config]);
  useEffect(() => { writeJson(UNMUTED_KEY, Array.from(unmuted)); }, [unmuted]);
  const activeId = activeGameId && unmuted.has(activeGameId) ? extractYouTubeId(config[activeGameId]?.youtubeUrl || '') : null;
  const iframeSrc = activeId ? `https://www.youtube-nocookie.com/embed/${activeId}?autoplay=1&controls=0&disablekb=1&fs=0&loop=1&playlist=${activeId}&playsinline=1&rel=0` : 'about:blank';
  const value = useMemo<AudioContextValue>(() => ({ config, activeGameId, setActiveGame, hasAudio: id => !!config[id] && !!extractYouTubeId(config[id].youtubeUrl), isMuted: id => !unmuted.has(id), toggleMute: id => setUnmuted(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }), upsertEntry: (id, entry) => setConfig(prev => ({ ...prev, [id]: { youtubeUrl: entry.youtubeUrl.trim(), volume: clampVolume(entry.volume ?? DEFAULT_VOLUME) } })), setVolume: (id, volume) => setConfig(prev => prev[id] ? { ...prev, [id]: { ...prev[id], volume: clampVolume(volume) } } : prev), removeEntry: id => setConfig(prev => { const next = { ...prev }; delete next[id]; return next; }) }), [config, activeGameId, unmuted]);
  return <Context.Provider value={value}>{children}<iframe key={iframeSrc} title="Optional game focus audio" src={iframeSrc} aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0 }} /></Context.Provider>;
}
