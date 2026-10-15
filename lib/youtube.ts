export type AudioTopic = 'study' | 'meditation';
export type YouTubeTrack = { id: string; title: string; channel: string; topic: AudioTopic; duration?: string };
export const DEFAULT_TRACKS: YouTubeTrack[] = [
  { id: process.env.NEXT_PUBLIC_YOUTUBE_AUDIO_VIDEO_ID || 'm_v9Vp_FKF8', title: 'Study Music', channel: 'Focus channel', topic: 'study' },
  { id: process.env.NEXT_PUBLIC_YOUTUBE_MEDITATION_VIDEO_ID || '5qap5aO4i9A', title: 'Meditation Vibes', channel: 'Calm channel', topic: 'meditation' },
];
export function youtubeEmbedUrl(videoId: string) { return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=0&controls=1&rel=0`; }
export function isYouTubeVideoId(value: string) { return /^[A-Za-z0-9_-]{11}$/.test(value); }
