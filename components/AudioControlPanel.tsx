'use client';
import { useGameAudio } from '@/lib/audio/GameAudioManager';

const DEFAULTS = { neonDrift: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', islandResilience: 'https://www.youtube.com/watch?v=5qap5aO4i9A' };
export default function AudioControlPanel() {
  const audio = useGameAudio();
  const active = audio.activeGameId;
  const select = (id: string) => { audio.setActiveGame(id); if (audio.isMuted(id)) audio.toggleMute(id); };
  return <section className="mt-6 rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-4" aria-label="Game audio controls"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Focus soundtrack</p><p className="mt-1 text-sm text-slate-400">Audio is optional, local to this device, and never required for play.</p></div><div className="flex flex-wrap gap-2">{Object.entries(DEFAULTS).map(([id]) => <button key={id} type="button" onClick={() => select(id)} className={`rounded-full border px-3 py-2 text-xs font-black transition ${active === id ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/15 text-slate-300 hover:border-cyan-300/60'}`}>{id === 'neonDrift' ? 'NEON//DRIFT' : 'ISLAND RESILIENCE'}</button>)}</div></div>{active && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400"><button type="button" onClick={() => audio.toggleMute(active)} className="rounded-full border border-white/15 px-3 py-1.5 text-white">{audio.isMuted(active) ? 'Unmute' : 'Mute'}</button><label className="flex items-center gap-2">Volume<input type="range" min="0" max="100" value={audio.config[active]?.volume ?? 30} onChange={event => audio.setVolume(active, Number(event.target.value))} /></label></div>}</section>;
}
