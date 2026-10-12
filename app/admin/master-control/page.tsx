import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import MasterControl from '@/components/admin/MasterControl';
export const dynamic = 'force-dynamic';
export default async function MasterControlPage() { const session = await getSession(); if (!session || session.role !== 'admin') redirect('/admin/login'); return <main className="mx-auto max-w-7xl px-4 py-12 lg:px-8"><p className="eyebrow">AX Admin · Master control</p><h1 className="mt-3 text-4xl font-black text-white">Operate the learning signal.</h1><p className="mt-2 text-slate-400">Signed in as {session.email}. Production controls are audited and server-gated.</p><div className="mt-10"><MasterControl /></div></main>; }
