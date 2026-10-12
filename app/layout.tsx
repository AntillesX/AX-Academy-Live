import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StudyMusicPlayer from '@/components/StudyMusicPlayer';
import BroadcastBanner from '@/components/BroadcastBanner';
import IntroGate from '@/components/IntroGate';

export const metadata = {
  title: 'AX-Academy Live | Learn the Caribbean, build the future',
  description: 'A child-friendly CSEC learning and focus platform for Caribbean students.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Header /><BroadcastBanner /><main className="min-h-screen pt-24">{children}</main><Footer /><StudyMusicPlayer /><IntroGate /></body></html>;
}
