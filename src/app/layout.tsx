import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

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
          <span className="sample-badge" title="Events are generated sample data until real scrapers are enabled">
            Sample data
          </span>
        </header>
        {children}
      </body>
    </html>
  );
}
