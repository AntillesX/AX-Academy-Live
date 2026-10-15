import Link from 'next/link';
import CargoGame from '@/src/games/carib-cargo/CargoGame';
import StudyMusicPlayer from '@/components/StudyMusicPlayer';
export const metadata = { title: 'Carib Cargo | AX Academy' };
export default function CaribCargoPage(){return <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Arcade · logistics simulation</p><h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Carib Cargo <span className="text-amber-300">East Port</span></h1><p className="mt-4 max-w-2xl text-slate-400">Load and deliver essential supplies through a safe, resilient island logistics network.</p></div><div className="flex items-center gap-3"><StudyMusicPlayer inline /><Link href="/arcade" className="btn-secondary">← Arcade lounge</Link></div></div><CargoGame /></div>}
