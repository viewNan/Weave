import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Weave — A world of your own',
  description: 'A little planet for everything you learn, build, and remember.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Weave' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
