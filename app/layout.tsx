import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BroadcastBanner from '@/components/BroadcastBanner';
import IntroGate from '@/components/IntroGate';
import PageBackground from '@/components/backgrounds/PageBackground';

export const metadata = { title: 'AX-Academy Live | Focused learning for regional and global classrooms', description: 'An independent, child-friendly educational service for focused learning, CSEC support, and privacy-aware academic progress.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><PageBackground /><div className="relative z-10 min-h-screen w-full min-w-0 overflow-x-hidden"><Header /><BroadcastBanner /><main className="min-h-screen w-full min-w-0 overflow-x-hidden pt-24">{children}</main><Footer /></div><IntroGate /></body></html>;
}
