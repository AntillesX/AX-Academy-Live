import Link from 'next/link';
import CoastalFishing from '@/src/games/coastal-fishing/CoastalFishing';
import StudyMusicPlayer from '@/components/StudyMusicPlayer';
export const metadata = { title: 'Coastal Fishing | AX Academy' };
export default function CoastalFishingPage(){return <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Arcade · sustainability mini-game</p><h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Tide &amp; Net <span className="text-cyan-300">Coastal Fishing</span></h1><p className="mt-4 max-w-2xl text-slate-400">Read the water, land your cast, and make responsible keep-or-release decisions. Scores remain closed-loop learning telemetry.</p></div><div className="flex items-center gap-3"><StudyMusicPlayer inline /><Link href="/games" className="btn-secondary">← Games hub</Link></div></div><CoastalFishing /></div>}
