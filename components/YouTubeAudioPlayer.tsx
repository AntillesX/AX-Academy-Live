'use client';
import { useEffect, useRef, useState } from 'react';

declare global { interface Window { YT?: { Player: new (id: string, options: { videoId: string; playerVars?: Record<string, number | string>; events?: { onReady?: (event: { target: { mute: () => void; unMute: () => void; setVolume: (volume: number) => void; playVideo: () => void; pauseVideo: () => void } }) => void; onStateChange?: (event: { data: number }) => void } }) => { mute: () => void; unMute: () => void; setVolume: (volume: number) => void; playVideo: () => void; pauseVideo: () => void }; PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number } }; onYouTubeIframeAPIReady?: () => void } }

export default function YouTubeAudioPlayer({ videoId }: { videoId: string }) {
  const playerRef = useRef<{ mute: () => void; unMute: () => void; setVolume: (volume: number) => void; playVideo: () => void; pauseVideo: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(38);

  useEffect(() => {
    const createPlayer = () => { if (!window.YT || playerRef.current) return; playerRef.current = new window.YT.Player('antillesx-audio-player', { videoId, playerVars: { autoplay: 1, controls: 0, loop: 1, mute: 1, playsinline: 1, playlist: videoId }, events: { onReady: ({ target }) => { target.mute(); target.setVolume(volume); setReady(true); }, onStateChange: ({ data }) => { setPlaying(data === window.YT?.PlayerState?.PLAYING); } } }); };
    if (window.YT) createPlayer(); else { const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]'); if (!existing) { const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; document.body.appendChild(script); } const previous = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { previous?.(); createPlayer(); }; }
    return () => { window.onYouTubeIframeAPIReady = undefined; };
  }, [videoId, volume]);

  function toggleAudio() { if (!playerRef.current) return; if (muted) { playerRef.current.unMute(); playerRef.current.setVolume(volume); playerRef.current.playVideo(); setMuted(false); } else { playerRef.current.mute(); setMuted(true); } }
  function updateVolume(value: number) { setVolume(value); playerRef.current?.setVolume(value); if (value > 0 && muted) { playerRef.current?.unMute(); setMuted(false); } }
  return <div className="relative flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-2 py-1 shadow-sm backdrop-blur" aria-label="Background audio player"><div id="antillesx-audio-player" className="pointer-events-none absolute h-px w-px opacity-0" /><button type="button" onClick={toggleAudio} disabled={!ready} className="rounded-full bg-black px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">{muted ? 'Play audio' : playing ? 'Mute audio' : 'Resume audio'}</button><span className="hidden max-w-28 truncate text-[11px] font-bold sm:inline">Island signal / AntillesX</span><label className="flex items-center gap-1 text-[10px] text-black/50"><span className="sr-only">Volume</span><input aria-label="Audio volume" type="range" min="0" max="100" value={volume} onChange={(event) => updateVolume(Number(event.target.value))} className="w-16 accent-black" />{volume}%</label></div>;
}
