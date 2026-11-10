import type { RawEvent, Source } from "../types";
import { politeFetch } from "../polite-fetch";

/**
 * Generic venue-website scraper. Many venue sites (Squarespace, Wix, WordPress
 * event plugins) embed schema.org Event / MusicEvent JSON-LD, which is the
 * most robust thing to read. Add a venue's events page to VENUE_PAGES only
 * after checking its terms of service and robots.txt; politeFetch enforces
 * robots.txt and rate limits.
 */
export const VENUE_PAGES: { url: string; termsCheckedOn: string }[] = [
  // { url: "https://venue.example/events", termsCheckedOn: "2026-11-10" },
];

interface JsonLdEvent {
  "@type"?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  url?: string;
  image?: string | string[];
  location?: { name?: string; address?: string | { streetAddress?: string; addressLocality?: string }; geo?: { latitude?: number | string; longitude?: number | string } };
  offers?: { price?: string | number; url?: string } | { price?: string | number; url?: string }[];
}

export function extractJsonLdEvents(html: string, pageUrl: string): RawEvent[] {
  const out: RawEvent[] = [];
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    const items = (Array.isArray(data) ? data : [data]).flatMap((d: any) => (d?.["@graph"] ? d["@graph"] : [d]));
    for (const it of items as JsonLdEvent[]) {
      const types = ([] as string[]).concat(it["@type"] ?? []);
      if (!types.some((t) => /Event$/.test(t)) || !it.name || !it.startDate) continue;
      const addr = it.location?.address;
      const offer = Array.isArray(it.offers) ? it.offers[0] : it.offers;
      out.push({
        sourceId: "jsonld-venue",
        sourceUrl: it.url ?? pageUrl,
        title: it.name,
        venueName: it.location?.name ?? "",
        address: typeof addr === "string" ? addr : addr?.streetAddress,
        city: typeof addr === "object" ? addr?.addressLocality : undefined,
        latitude: it.location?.geo?.latitude != null ? Number(it.location.geo.latitude) : undefined,
        longitude: it.location?.geo?.longitude != null ? Number(it.location.geo.longitude) : undefined,
        date: it.startDate,
        endTime: it.endDate?.match(/T(\d{2}:\d{2})/)?.[1],
        description: it.description,
        category: types.join(" "),
        cover: offer?.price != null ? String(offer.price) : undefined,
        ticketUrl: offer?.url,
        imageUrl: Array.isArray(it.image) ? it.image[0] : it.image,
        verified: true,
      });
    }
  }
  return out;
}

export const jsonLdVenueSource: Source = {
  id: "jsonld-venue",
  name: "Venue websites (schema.org JSON-LD)",
  kind: "venue-website",
  termsNote: "Only pages listed in VENUE_PAGES, each ToS-checked; robots.txt enforced by politeFetch.",
  enabled: () => VENUE_PAGES.length > 0,
  async fetch() {
    const out: RawEvent[] = [];
    for (const p of VENUE_PAGES) {
      try {
        out.push(...extractJsonLdEvents(await politeFetch(p.url), p.url));
      } catch (err) {
        console.warn(`[jsonld-venue] ${p.url}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};
