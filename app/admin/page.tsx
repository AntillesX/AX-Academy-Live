import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import MediaManager from '@/components/media-manager';
export default async function AdminPage() { const session = await getSession(); if (!session || session.role !== 'admin') redirect('/'); return <main className="min-h-screen bg-black px-6 py-12 text-white md:px-12"><div className="mx-auto max-w-3xl"><p className="text-xs uppercase tracking-[.3em] text-[#d8ff45]">AntillesX / Admin</p><h1 className="mt-4 text-5xl font-black tracking-[-.07em]">Media control room.</h1><p className="mt-4 max-w-xl text-white/60">Signed in as {session.email}. Upload a new MP4 and it becomes the landing experience automatically.</p><MediaManager /></div></main>; }
