'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const INTRO_VIDEO_ID = 'ZZgmi8Q7B8Q';
const INTRO_SEEN_KEY = 'ax-academy-intro-seen';

export default function IntroGate() {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(INTRO_SEEN_KEY) !== 'true');
    setReady(true);
  }, []);

  function enter(destination = '/') {
    window.localStorage.setItem(INTRO_SEEN_KEY, 'true');
    window.dispatchEvent(new CustomEvent('ax-academy-enter', { detail: { destination } }));
    setVisible(false);
    if (destination !== '/') window.location.href = destination;
  }

  if (!ready || !visible) return null;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#020617] p-4 sm:p-8">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,.2),transparent_42%)]" />
    <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/90 shadow-2xl shadow-cyan-950/40">
      <div className="grid lg:grid-cols-[1.35fr_.65fr]">
        <div className="relative aspect-video min-h-[16rem] bg-black lg:min-h-[32rem]">
          <iframe title="AX Academy Solutions introduction" className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${INTRO_VIDEO_ID}?autoplay=1&mute=1&controls=1&rel=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
        </div>
        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <div className="mx-auto w-28 overflow-hidden rounded-2xl border border-cyan-300/30 bg-slate-900 shadow-lg shadow-cyan-500/10 sm:mx-0 sm:w-36"><Image src="/ax-academy-logo.jpg" alt="AX Academy Solutions" width={360} height={360} priority className="h-auto w-full" /></div>
            <p className="eyebrow mt-7">Welcome to AX-Academy Live</p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">Your next bright signal starts here.</h1>
            <p className="mt-4 text-sm leading-6 text-slate-400">Learn, focus, create, and connect across the Caribbean with AX Academy Solutions.</p>
          </div>
          <div className="mt-8 space-y-2">
            <button type="button" onClick={() => enter('/')} className="btn-primary w-full">Enter site <span className="ml-2">→</span></button>
            <div className="grid grid-cols-2 gap-2"><Link href="/onboarding" onClick={() => enter('/onboarding')} className="btn-secondary text-center text-xs">Register</Link><button type="button" onClick={() => enter('/curriculum')} className="btn-secondary text-xs">Browse first</button></div>
            <p className="pt-2 text-center text-[11px] text-slate-600">Your choice starts the optional background focus player.</p>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
