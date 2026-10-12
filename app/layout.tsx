import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BroadcastBanner from '@/components/BroadcastBanner';
import IntroGate from '@/components/IntroGate';
import PageBackground from '@/components/backgrounds/PageBackground';

export const metadata = { title: 'AX-Academy Live | Learn the Caribbean, build the future', description: 'A child-friendly CSEC learning and focus platform for Caribbean students.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><PageBackground /><div className="relative z-10 min-h-screen"><Header /><BroadcastBanner /><main className="min-h-screen pt-24">{children}</main><Footer /></div><IntroGate /></body></html>;
}
