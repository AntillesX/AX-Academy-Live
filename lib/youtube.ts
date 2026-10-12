export type YouTubeTrack = { id: string; title: string; channel: string; duration?: string };
export const DEFAULT_TRACKS: YouTubeTrack[] = [
  { id: process.env.NEXT_PUBLIC_YOUTUBE_AUDIO_VIDEO_ID || 'jfKfPfyJRdk', title: 'lofi hip hop radio', channel: 'Lofi Girl' },
  { id: '5qap5aO4i9A', title: 'lofi beats to relax/study to', channel: 'Lofi Girl' },
];
export function youtubeEmbedUrl(videoId: string) { return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=0&controls=1&rel=0`; }
export function isYouTubeVideoId(value: string) { return /^[A-Za-z0-9_-]{11}$/.test(value); }
