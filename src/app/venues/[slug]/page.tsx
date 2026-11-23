import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventCard from "@/components/EventCard";
import { getAllEvents } from "@/lib/events-store";
import { clip, eventJsonLd, jsonLdString, pageMeta, townPath, upcoming, venuePath } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function findVenue(slug: string) {
  const path = `/venues/${slug}`;
  const all = getAllEvents();
  const any = all.find((e) => venuePath(e) === path);
  if (!any) return undefined;
  return { info: any, path, events: upcoming(all).filter((e) => venuePath(e) === path) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = findVenue((await params).slug);
  if (!v) return { title: "Venue not found" };
  const { venueName, city, address } = v.info;
  const next = v.events[0];
  const description = clip(
    v.events.length
      ? `Live music and events at ${venueName}, ${address}, ${city}, NS. ${v.events.length} coming up${next ? `, next: ${next.title}` : ""}.`
      : `Live music and events at ${venueName}, ${address}, ${city}, NS. Nothing listed right now.`,
  );
  return {
    ...pageMeta({ title: `${venueName}, ${city}: live music and events`, description, path: v.path }),
    ...(v.events.length === 0 && { robots: { index: false, follow: true } }),
  };
}

export default async function VenuePage({ params }: Props) {
  const v = findVenue((await params).slug);
  if (!v) notFound();
  const { venueName, city, address, website, latitude, longitude } = v.info;

  const placeLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: venueName,
    address: { "@type": "PostalAddress", streetAddress: address, addressLocality: city, addressRegion: "NS", addressCountry: "CA" },
    geo: { "@type": "GeoCoordinates", latitude, longitude },
    ...(website && { url: website }),
  };
  const shown = v.events.slice(0, 40);

  return (
    <main className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(placeLd) }} />
      {shown.map((e) => (
        <script key={e.id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(eventJsonLd(e)) }} />
      ))}
      <p className="crumbs">
        <Link href="/">All of Nova Scotia</Link> › <Link href={townPath(city)}>{city}</Link> › {venueName}
      </p>
      <h1>{venueName}</h1>
      <p className="lede">
        {address}, {city}, NS
        {website && (
          <>
            {" · "}
            <a href={website} target="_blank" rel="noopener noreferrer">Venue website</a>
          </>
        )}
      </p>

      {shown.length > 0 ? (
        <div className="cards">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <p>Nothing listed here right now.</p>
      )}

      <p className="small muted" style={{ marginTop: 16 }}>
        Something wrong or missing? <Link href="/suggest">Let us know</Link>.
      </p>
    </main>
  );
}
