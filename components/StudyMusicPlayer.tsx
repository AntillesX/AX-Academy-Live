'use client';
import { useEffect, useState } from 'react';
import { youtubeEmbedUrl, DEFAULT_TRACKS, type AudioTopic, type YouTubeTrack } from '@/lib/youtube';
type Props = { inline?: boolean; pillClassName?: string };
const DEFAULT_PILL = 'inline-flex min-h-9 w-9 items-center justify-center rounded-full border border-cyan-300/50 bg-slate-950/80 text-xs font-black text-white transition hover:border-cyan-200 hover:bg-slate-800 hover:shadow-[0_0_18px_rgba(34,211,238,.28)]';
const SOURCE_URL = 'https://youtu.be/m_v9Vp_FKF8';
export default function StudyMusicPlayer({ inline = false, pillClassName = DEFAULT_PILL }: Props) {
  const [started, setStarted] = useState(false); const [topic, setTopic] = useState<AudioTopic>('study'); const [tracks, setTracks] = useState<YouTubeTrack[]>(DEFAULT_TRACKS);
  useEffect(() => { fetch('/api/music').then(response => response.json()).then(data => { if (data.tracks) setTracks(data.tracks); }).catch(() => undefined); }, []);
  const track = tracks.find(item => item.topic === topic) || DEFAULT_TRACKS.find(item => item.topic === topic) || DEFAULT_TRACKS[0];
  const src = `${youtubeEmbedUrl(track.id)}${started ? '&autoplay=1' : ''}`;
  useEffect(() => { if (!started) return; const record = { provider: 'youtube', source: SOURCE_URL, videoId: track.id, topic, timestamp: new Date().toISOString() }; try { localStorage.setItem('ax-audio-source', JSON.stringify(record)); window.dispatchEvent(new CustomEvent('ax-audio-source', { detail: record })); } catch { /* attribution is best effort */ } }, [started, topic, track.id]);
  const toggle = () => { setTopic(value => value === 'study' ? 'meditation' : 'study'); setStarted(true); };
  return <div className={`${inline ? 'relative z-20 shrink-0' : 'fixed right-3 top-3 z-[60]'}`}><iframe title="AX Academy game audio" className="pointer-events-none absolute h-px w-px opacity-0" src={src} allow="autoplay; encrypted-media" aria-hidden="true" /><button type="button" onClick={toggle} className={pillClassName} aria-label={`Toggle ${topic === 'study' ? 'study' : 'meditation'} game audio`} title={`${topic === 'study' ? 'Study Music' : 'Meditation Vibes'} · tap to switch`}><span className="text-red-300">▶</span></button></div>;
}
