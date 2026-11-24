import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { isSampleData } from "@/lib/events-store";
import Analytics from "@/components/Analytics";
import FeedbackLink from "@/components/FeedbackLink";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    twitter: { card: "summary_large_image" },
    // Made-up sample events shouldn't end up in search results.
    ...(isSampleData() && { robots: { index: false, follow: true } }),
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bitter:wght@500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            NS Live Music <span className="brand-sub">Finder</span>
          </Link>
          <nav className="header-nav">
            <Link href="/suggest">Add a night</Link>
            <FeedbackLink />
          </nav>
          {isSampleData() && (
            <span className="sample-badge" title="These events are made-up examples until real event sources are switched on">
              Sample data
            </span>
          )}
        </header>
        {children}
        <footer className="site-footer">
          <p>
            Gigs, open mics, jams and kitchen parties around Nova Scotia, gathered from venue calendars, Eventbrite and
            people who send them in. Always check with the venue before you head out.
          </p>
          <p>
            <Link href="/suggest">Add a regular night</Link> · <FeedbackLink>Tell us what you think</FeedbackLink>
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
