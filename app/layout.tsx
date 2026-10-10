import './globals.css';
import Navbar from '@/components/Navbar';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
export const metadata = { title: 'AntillesX — Learn, earn, exchange', description: 'The Caribbean-first learning and rewards network.' };
export const dynamic = 'force-dynamic';
function extractYouTubeId(url?: string | null) { if (!url) return null; const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return match?.[1] || null; }
export default async function RootLayout({ children }: { children: React.ReactNode }) { const session = await getSession(); const profile = session ? (await supabaseAdmin.from('profiles').select('x_balance, antx_balance').eq('id', session.userId).maybeSingle()).data : null; const intro = (await supabaseAdmin.from('media_assets').select('file_url').eq('asset_type', 'intro_video').order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.file_url; const audioVideoId = extractYouTubeId(intro) || process.env.NEXT_PUBLIC_YOUTUBE_AUDIO_VIDEO_ID || 'jfKfPfyJRdk'; return <html lang="en"><body><Navbar antxBalance={Number(profile?.antx_balance || 0)} xpBalance={Number(profile?.x_balance || 0)} audioVideoId={audioVideoId} /><div className="pt-[7.25rem] md:pt-[4.75rem]">{children}</div></body></html>; }
