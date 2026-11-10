import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEventById } from "@/lib/events-store";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/types";
import { formatEventDate, formatEventTime } from "@/lib/time";
import EventImage from "@/components/EventImage";
import DetailsDirections from "@/components/DetailsDirections";
import MiniMap from "@/components/MiniMap";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = getEventById((await params).id);
  return { title: e ? `${e.title} · ${e.venueName} | NS Live Music Finder` : "Event not found" };
}

export default async function EventPage({ params }: Props) {
  const e = getEventById((await params).id);
  if (!e) notFound();

  const cover =
    e.coverCharge == null ? "Not listed" : e.coverCharge === 0 ? "Free / PWYC" : `$${e.coverCharge.toFixed(e.coverCharge % 1 ? 2 : 0)}`;

  return (
    <main className="details">
      <Link href="/" className="back">← All events</Link>
      <EventImage event={e} className="details-img" />
      <div className="details-grid">
        <div>
          <span className="type-pill" style={{ ["--type-color" as string]: EVENT_TYPE_COLOR[e.eventType] }}>
            {EVENT_TYPE_LABEL[e.eventType]}
          </span>
          {e.verified && <span className="verified" title="Listed by the venue itself">✓ Verified by venue</span>}
          <h1>{e.title}</h1>
          <p className="details-when">
            {formatEventDate(e.startDateTime)} · {formatEventTime(e.startDateTime)}
            {e.endDateTime && ` – ${formatEventTime(e.endDateTime)}`}
          </p>
          {e.description && <p className="details-desc">{e.description}</p>}

          <dl className="facts">
            <dt>Genre</dt>
            <dd>{e.genre?.length ? e.genre.join(", ") : "Not listed"}</dd>
            <dt>Cover</dt>
            <dd>{cover}</dd>
            <dt>Venue</dt>
            <dd>
              {e.venueName}
              <br />
              {e.address}, {e.city}, {e.province}
            </dd>
            {(e.website || e.ticketUrl) && (
              <>
                <dt>Links</dt>
                <dd className="links">
                  {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer">Venue website</a>}
                  {e.ticketUrl && <a href={e.ticketUrl} target="_blank" rel="noopener noreferrer">Tickets</a>}
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Original listing</a>
                </dd>
              </>
            )}
          </dl>
        </div>
        <aside className="details-side">
          <MiniMap event={e} />
          <DetailsDirections dest={{ lat: e.latitude, lng: e.longitude }} />
          <p className="muted small">Last updated {new Date(e.lastUpdated).toLocaleDateString("en-CA")}</p>
        </aside>
      </div>
    </main>
  );
}
