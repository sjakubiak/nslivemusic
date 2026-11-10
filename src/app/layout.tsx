import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { isSampleData } from "@/lib/events-store";

export const metadata: Metadata = {
  title: "NS Live Music Finder",
  description: "Live music, open mics and jam sessions at pubs, breweries and venues across Nova Scotia.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>♪</span>
            <span>
              NS Live Music <span className="brand-sub">Finder</span>
            </span>
          </Link>
          <nav className="header-nav">
            <Link href="/suggest">+ Add an event</Link>
          </nav>
          {isSampleData() && (
            <span className="sample-badge" title="These events are made-up examples until real event sources are switched on">
              Sample data
            </span>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
