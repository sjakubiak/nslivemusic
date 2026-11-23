import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventCard from "@/components/EventCard";
import { getAllEvents } from "@/lib/events-store";
import { NS_PLACES } from "@/lib/geo";
import { EVENT_TYPE_LABEL } from "@/lib/types";
import { clip, eventJsonLd, jsonLdString, pageMeta, slugify, townsWithEvents, upcoming, venuePath } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ town: string }> };

/** The town's name from its slug: from the events, or from the known towns list. */
function findTown(slug: string) {
  const all = getAllEvents();
  const name =
    all.find((e) => slugify(e.city) === slug)?.city ?? Object.keys(NS_PLACES).find((n) => slugify(n) === slug);
  if (!name) return undefined;
  const events = upcoming(all).filter((e) => slugify(e.city) === slug);
  return { name, events };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = findTown((await params).town);
  if (!t) return { title: "Town not found" };
  const venues = [...new Set(t.events.map((e) => e.venueName))];
  const description = t.events.length
    ? clip(`${t.events.length} upcoming gigs, open mics and jams in ${t.name}, NS${venues.length ? `, at ${venues.slice(0, 4).join(", ")}` : ""}. Times, cover charges and directions.`)
    : `Live music, open mics and jam sessions in ${t.name}, Nova Scotia. Nothing is listed right now, so check back soon or send in a night you know about.`;
  return {
    ...pageMeta({ title: `Live music in ${t.name}, Nova Scotia`, description, path: `/live-music/${slugify(t.name)}` }),
    ...(t.events.length === 0 && { robots: { index: false, follow: true } }),
  };
}

export default async function TownPage({ params }: Props) {
  const t = findTown((await params).town);
  if (!t) notFound();

  const shown = t.events.slice(0, 60);
  const venues = new Map<string, string>();
  for (const e of t.events) venues.set(venuePath(e), e.venueName);
  const kinds = [...new Set(t.events.map((e) => EVENT_TYPE_LABEL[e.eventType].toLowerCase()))];
  const others = townsWithEvents(getAllEvents()).filter((o) => o.slug !== slugify(t.name));

  return (
    <main className="page">
      {shown.map((e) => (
        <script key={e.id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(eventJsonLd(e)) }} />
      ))}
      <p className="crumbs">
        <Link href="/">All of Nova Scotia</Link> › {t.name}
      </p>
      <h1>Live music in {t.name}</h1>
      <p className="lede">
        {t.events.length === 0
          ? `Nothing is listed in ${t.name} right now.`
          : `${t.events.length} coming up${kinds.length ? `: ${kinds.join(", ")}` : ""}. Check with the venue before you go, since times and covers can change.`}{" "}
        <Link href="/suggest">Know of one we&apos;re missing?</Link>
      </p>

      {shown.length > 0 && (
        <div className="cards">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      {venues.size > 0 && (
        <>
          <h2>Venues in {t.name}</h2>
          <ul>
            {[...venues].map(([href, name]) => (
              <li key={href}>
                <Link href={href}>{name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <nav aria-label="Other towns">
          <h2>Other towns</h2>
          <p>
            {others.map((o, i) => (
              <span key={o.slug}>
                {i > 0 && " · "}
                <Link href={`/live-music/${o.slug}`}>{o.name}</Link>
              </span>
            ))}
          </p>
        </nav>
      )}
    </main>
  );
}
