"use client";
import Link from "next/link";
import type { EventWithDistance } from "@/lib/filters";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/types";
import { formatEventRange } from "@/lib/time";
import { formatDistance, type LatLng } from "@/lib/geo";
import EventImage from "./EventImage";
import DirectionsButtons from "./DirectionsButtons";

export default function EventCard({
  event,
  directionsOrigin,
  highlighted,
  onHover,
}: {
  event: EventWithDistance;
  directionsOrigin?: LatLng;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
}) {
  return (
    <article
      className={`card ${highlighted ? "is-highlighted" : ""}`}
      onMouseEnter={() => onHover?.(event.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Link href={`/events/${event.id}`} className="card-media" tabIndex={-1} aria-hidden>
        <EventImage event={event} className="card-img" />
      </Link>
      <div className="card-body">
        <div className="card-meta-row">
          <span className="type-pill" style={{ ["--type-color" as string]: EVENT_TYPE_COLOR[event.eventType] }}>
            {EVENT_TYPE_LABEL[event.eventType]}
          </span>
          {event.distanceKm != null && <span className="distance">{formatDistance(event.distanceKm)} away</span>}
        </div>
        <h3 className="card-title">
          <Link href={`/events/${event.id}`}>{event.title}</Link>
        </h3>
        <p className="card-venue">
          {event.venueName} · {event.city}
        </p>
        <p className="card-when">{formatEventRange(event.startDateTime, event.endDateTime)}</p>
        {!!event.genre?.length && <p className="card-genres">{event.genre.join(" · ")}</p>}
        <DirectionsButtons dest={{ lat: event.latitude, lng: event.longitude }} origin={directionsOrigin} compact />
      </div>
    </article>
  );
}
