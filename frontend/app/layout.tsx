<<<<<<< HEAD
import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./identity.css";
import "./color-theme.css";
import "./sunny.css";

export const metadata: Metadata = { title: "Weave", description: "Personal knowledge workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
=======
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Weave — A world of your own', description: 'A little planet for everything you learn, build, and remember.' };
export default function Layout({ children }: { children: React.ReactNode }) {
>>>>>>> 55d54c0 (created react threejs earth model on homepage)
  return <html lang="en"><body>{children}</body></html>;
}
