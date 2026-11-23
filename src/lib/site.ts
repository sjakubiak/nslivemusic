import type { Metadata } from "next";
import type { MusicEvent } from "./types";

/**
 * The public address of the site, used for canonical links, the sitemap and
 * social previews. Set SITE_URL (e.g. when a custom domain is added) to change it.
 */
export const SITE_URL = (process.env.SITE_URL || "https://nslivemusic.novascotia.workers.dev").replace(/\/+$/, "");
export const SITE_NAME = "NS Live Music Finder";
export const SITE_DESCRIPTION =
  "Find live music, open mics, jam sessions and kitchen parties tonight and this week in Halifax, Dartmouth and towns across Nova Scotia.";

/** "Annapolis Royal" -> "annapolis-royal", "Durty Nelly's" -> "durty-nellys". */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const townPath = (city: string) => `/live-music/${slugify(city)}`;
export const venuePath = (e: Pick<MusicEvent, "venueName" | "city">) => `/venues/${slugify(`${e.venueName} ${e.city}`)}`;

/** Events that haven't finished yet (no end time: treat as 3 hours long). */
export function upcoming(events: MusicEvent[], now = new Date()): MusicEvent[] {
  const t = now.getTime();
  return events
    .filter((e) => new Date(e.endDateTime ?? new Date(new Date(e.startDateTime).getTime() + 3 * 3600_000)).getTime() > t)
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

export function isPast(e: MusicEvent, now = new Date()): boolean {
  return upcoming([e], now).length === 0;
}

export interface Town {
  name: string;
  slug: string;
  events: MusicEvent[];
}

/** Towns with at least one upcoming event, busiest first. */
export function townsWithEvents(events: MusicEvent[], now = new Date()): Town[] {
  const by = new Map<string, Town>();
  for (const e of upcoming(events, now)) {
    const slug = slugify(e.city);
    if (!slug) continue;
    const t = by.get(slug) ?? { name: e.city, slug, events: [] };
    t.events.push(e);
    by.set(slug, t);
  }
  return [...by.values()].sort((a, b) => b.events.length - a.events.length || a.name.localeCompare(b.name));
}

export interface Venue {
  name: string;
  slug: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  website?: string;
  events: MusicEvent[];
}

/** Venues with at least one upcoming event. */
export function venuesWithEvents(events: MusicEvent[], now = new Date()): Venue[] {
  const by = new Map<string, Venue>();
  for (const e of upcoming(events, now)) {
    const slug = venuePath(e).slice("/venues/".length);
    if (!slug) continue;
    const v =
      by.get(slug) ??
      { name: e.venueName, slug, city: e.city, address: e.address, latitude: e.latitude, longitude: e.longitude, website: e.website, events: [] };
    v.events.push(e);
    by.set(slug, v);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Search-snippet length: cut at a word boundary. */
export function clip(s: string, max = 155): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max - 1)).replace(/[,.;:!-]+$/, "") + "…";
}

const MUSIC_TYPES = new Set(["LIVE_MUSIC", "OPEN_MIC", "JAM_SESSION"]);

/** schema.org Event / MusicEvent data for Google's event listings. */
export function eventJsonLd(e: MusicEvent): Record<string, unknown> {
  const url = `${SITE_URL}/events/${e.id}`;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": MUSIC_TYPES.has(e.eventType) ? "MusicEvent" : "Event",
    name: e.title,
    url,
    startDate: e.startDateTime,
    ...(e.endDateTime && { endDate: e.endDateTime }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(e.description && { description: clip(e.description, 500) }),
    ...(e.imageUrl && { image: [e.imageUrl] }),
    ...(e.genre?.length && { genre: e.genre }),
    location: {
      "@type": "Place",
      name: e.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: e.address,
        addressLocality: e.city,
        addressRegion: "NS",
        addressCountry: "CA",
      },
      geo: { "@type": "GeoCoordinates", latitude: e.latitude, longitude: e.longitude },
      ...(e.website && { url: e.website }),
    },
  };
  if (e.coverCharge != null || e.ticketUrl) {
    data.offers = {
      "@type": "Offer",
      url: e.ticketUrl ?? url,
      ...(e.coverCharge != null && { price: e.coverCharge, priceCurrency: "CAD" }),
      availability: "https://schema.org/InStock",
    };
  }
  if (e.website) data.organizer = { "@type": "Organization", name: e.venueName, url: e.website };
  return data;
}

/** Safe to drop into <script type="application/ld+json">. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Title, description, canonical link and social preview for one page. */
export function pageMeta(opts: { title: string; description: string; path: string; image?: string; absoluteTitle?: boolean }): Metadata {
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_CA",
      url: opts.path,
      title: opts.title,
      description: opts.description,
      ...(opts.image && { images: [opts.image] }),
    },
  };
}
