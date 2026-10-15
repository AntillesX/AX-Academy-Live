import type { Metadata } from 'next';
import Link from 'next/link';
import StudyMusicPlayer from '@/components/StudyMusicPlayer';
import { CaribSkydive } from '@/src/components/games/CaribSkydive';

export const metadata: Metadata = {
  title: 'Carib Skydive | AX Academy Arcade',
  description: 'A 3D Caribbean skydiving arcade run through CXC-aligned FOOD, MEDICAL, SOLAR, and WATER signal gates.',
};

export default function CaribSkydivePage() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Arcade · 3D skydiving</p>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">Carib Skydive <span className="text-cyan-300">Signal Run</span></h1>
          <p className="mt-4 max-w-2xl text-slate-400">Steer through Caribbean supply rings: Green FOOD, Red MEDICAL, Yellow SOLAR, and Blue WATER. Dive for speed; deploy the chute to recover control.</p>
        </div>
        <div className="flex items-center gap-3">
          <StudyMusicPlayer inline />
          <Link href="/arcade" className="btn-secondary">← Arcade lounge</Link>
        </div>
      </div>
      <CaribSkydive />
    </section>
  );
}
