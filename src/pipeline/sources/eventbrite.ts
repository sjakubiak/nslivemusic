import type { RawEvent, Source } from "../types";
import { htmlToText, truncate } from "../text";

/**
 * Eventbrite, official API only (https://www.eventbrite.com/platform/api).
 * HTML scraping is against their terms, and the public event-search endpoint
 * was retired in 2020, so we read the public events of specific organizers:
 *
 *   EVENTBRITE_TOKEN          a free private token from eventbrite.com/platform
 *   EVENTBRITE_ORGANIZER_IDS  comma-separated organizer IDs (the number at the
 *                             end of an organizer's eventbrite.ca/o/... URL)
 *
 * Only in-person events in Nova Scotia are kept.
 */
const API = "https://www.eventbriteapi.com/v3";

interface EbEvent {
  name: { text: string };
  description?: { text?: string };
  url: string;
  start: { utc: string };
  end?: { local?: string };
  is_free?: boolean;
  online_event?: boolean;
  status?: string;
  logo?: { url?: string } | null;
  venue?: {
    name?: string;
    address?: { address_1?: string; city?: string; region?: string; latitude?: string; longitude?: string };
  } | null;
  ticket_availability?: { minimum_ticket_price?: { major_value?: string } | null } | null;
}

export function mapEventbriteEvent(e: EbEvent): RawEvent | null {
  const a = e.venue?.address;
  if (e.online_event || !a) return null;
  if (a.region && !/^(ns|nova scotia)$/i.test(a.region.trim())) return null;
  const price = e.ticket_availability?.minimum_ticket_price?.major_value;
  return {
    sourceId: "eventbrite",
    sourceUrl: e.url,
    title: e.name.text,
    venueName: e.venue?.name ?? "",
    address: a.address_1,
    city: a.city,
    latitude: a.latitude ? Number(a.latitude) : undefined,
    longitude: a.longitude ? Number(a.longitude) : undefined,
    date: e.start.utc, // "2026-11-15T00:00:00Z"
    endTime: e.end?.local?.slice(11, 16),
    description: truncate(htmlToText(e.description?.text ?? "")),
    cover: e.is_free ? "Free" : price ? `$${price}` : undefined,
    ticketUrl: e.url,
    imageUrl: e.logo?.url,
    verified: true, // organizer-published
  };
}

const organizerIds = () => (process.env.EVENTBRITE_ORGANIZER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const eventbriteSource: Source = {
  id: "eventbrite",
  name: "Eventbrite (official API)",
  kind: "listing-site",
  termsNote: "Official API with a private token; organizer-scoped, public events only.",
  enabled: () => Boolean(process.env.EVENTBRITE_TOKEN) && organizerIds().length > 0,
  async fetch() {
    const out: RawEvent[] = [];
    const headers = { Authorization: `Bearer ${process.env.EVENTBRITE_TOKEN}` };
    for (const id of organizerIds()) {
      let continuation: string | undefined;
      try {
        for (let page = 0; page < 10; page++) {
          const qs = new URLSearchParams({ status: "live", expand: "venue,ticket_availability", page_size: "50" });
          if (continuation) qs.set("continuation", continuation);
          const res = await fetch(`${API}/organizers/${id}/events/?${qs}`, { headers });
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const body = (await res.json()) as { events: EbEvent[]; pagination?: { has_more_items?: boolean; continuation?: string } };
          for (const e of body.events) {
            const r = mapEventbriteEvent(e);
            if (r) out.push(r);
          }
          if (!body.pagination?.has_more_items) break;
          continuation = body.pagination.continuation;
        }
      } catch (err) {
        console.warn(`[eventbrite] organizer ${id}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};
