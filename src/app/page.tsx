import Link from "next/link";
import type { Metadata } from "next";
import Finder from "@/components/Finder";
import { getAllEvents } from "@/lib/events-store";
import { jsonLdString, pageMeta, SITE_DESCRIPTION, SITE_NAME, SITE_URL, townsWithEvents } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Live music in Nova Scotia tonight and this week",
  description: SITE_DESCRIPTION,
  path: "/",
});

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: "en-CA",
};

export default function Home() {
  const events = getAllEvents();
  const towns = townsWithEvents(events);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteLd) }} />
      <Finder
        events={events}
        intro={
          <div className="intro">
            <h1>Live music in Nova Scotia</h1>
            <p>Gigs, open mics, jams and kitchen parties from Yarmouth to Cape Breton. Pick a town or use your location to see what&apos;s on near you.</p>
          </div>
        }
      />
      {towns.length > 0 && (
        <nav className="town-links" aria-label="Live music by town">
          <h2>Live music by town</h2>
          <ul>
            {towns.map((t) => (
              <li key={t.slug}>
                <Link href={`/live-music/${t.slug}`}>{t.name}</Link> <span className="muted">({t.events.length})</span>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
