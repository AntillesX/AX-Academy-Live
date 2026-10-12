'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['⌂', 'Dashboard', '/dashboard'], ['▣', 'CSEC Hub', '/curriculum'], ['✦', 'Arcade', '/games'],
  ['↗', 'Market Sim', '/emulator'], ['◈', 'UGC Shop', '/marketplace'], ['◎', 'Community', '/community'],
];
export default function Header() {
  const pathname = usePathname();
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
      <Link href="/" className="shrink-0 text-xl font-black tracking-tight"><span className="text-cyan-300">AX</span><span className="text-white">-ACADEMY</span><span className="text-violet-300">.LIVE</span></Link>
      <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">{links.map(([icon, label, href]) => <Link key={href} href={href} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${pathname === href ? 'bg-cyan-300/15 text-cyan-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><span className="mr-1.5 text-base">{icon}</span>{label}</Link>)}</nav>
      <Link href="/api/auth/roblox" className="ml-auto rounded-xl border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-400/20">◉ Roblox Login</Link>
    </div>
    <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">{links.map(([icon, label, href]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-300">{icon} {label}</Link>)}</nav>
  </header>;
}
