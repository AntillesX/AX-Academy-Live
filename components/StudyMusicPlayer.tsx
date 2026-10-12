'use client';
import { useEffect, useState } from 'react';
import { youtubeEmbedUrl, DEFAULT_TRACKS, type YouTubeTrack } from '@/lib/youtube';

export default function StudyMusicPlayer({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [track, setTrack] = useState<YouTubeTrack>(DEFAULT_TRACKS[0]);
  const [tracks, setTracks] = useState(DEFAULT_TRACKS);
  useEffect(() => {
    fetch('/api/music').then(response => response.json()).then(data => { if (data.tracks) setTracks(data.tracks); }).catch(() => undefined);
    const enter = () => { setStarted(true); setOpen(false); };
    window.addEventListener('ax-academy-enter', enter);
    return () => window.removeEventListener('ax-academy-enter', enter);
  }, []);
  const src = `${youtubeEmbedUrl(track.id)}${started ? '&autoplay=1' : ''}`;
  return <div className={`${inline ? 'relative z-20' : 'fixed right-3 top-[4.6rem] z-[60] sm:right-5'}`}><div className={`overflow-hidden rounded-full border border-cyan-300/20 bg-slate-950/90 shadow-lg shadow-cyan-950/20 backdrop-blur-xl transition-all ${open ? 'w-64 rounded-2xl' : 'w-auto'}`}><div className="flex items-center gap-1.5 px-2 py-1.5"><button type="button" onClick={() => { setOpen(!open); setStarted(true); }} className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-white/10" aria-label="Toggle focus music player"><span className={`grid h-5 w-5 place-items-center rounded-full ${started ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-cyan-200'}`}>♫</span><span className="hidden sm:inline">{started ? 'Focus on' : 'Focus'}</span></button><span className="h-4 w-px bg-white/10" /><button type="button" onClick={() => setOpen(!open)} className="px-1 text-[10px] text-slate-500" aria-label="Open music controls">{open ? '×' : '⌄'}</button></div>{open && <div className="border-t border-white/10 p-2"><div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe title={track.title} className="h-full w-full" src={src} allow="autoplay; encrypted-media" /></div><select value={track.id} onChange={event => { setTrack(tracks.find(item => item.id === event.target.value) || track); setStarted(true); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] text-white">{tracks.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></div>}</div></div>;
}
