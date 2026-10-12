import { NextResponse } from 'next/server';
import { DEFAULT_TRACKS, isYouTubeVideoId, youtubeEmbedUrl } from '@/lib/youtube';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ tracks: DEFAULT_TRACKS.map(track => ({ ...track, embedUrl: youtubeEmbedUrl(track.id) })), policy: 'Optional focus audio; external YouTube playback is user-controlled.' }); }
export async function POST(request: Request) { const body = await request.json().catch(() => ({})); const id = typeof body.videoId === 'string' ? body.videoId : ''; if (!isYouTubeVideoId(id)) return NextResponse.json({ error: 'Invalid YouTube video ID.' }, { status: 400 }); return NextResponse.json({ videoId: id, embedUrl: youtubeEmbedUrl(id) }); }
