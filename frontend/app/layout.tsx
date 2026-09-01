import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./identity.css";
import "./color-theme.css";
import "./sunny.css";

export const metadata: Metadata = { title: "Weave", description: "Personal knowledge workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
