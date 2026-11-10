import type { RawEvent, Source } from "../types";
import { truncate } from "../text";

/**
 * Facebook events, via the Graph API for venue Pages that have granted us
 * access. We do NOT scrape facebook.com: Meta's terms forbid automated
 * collection, they actively block and sue scrapers, and logged-out pages hide
 * most events anyway. Meta also closed general public-events search, so the
 * only sanctioned route is per-Page:
 *
 *   1. Create a Meta app (developers.facebook.com) and request the
 *      `pages_read_engagement` permission (needs App Review for Pages you
 *      don't admin).
 *   2. A venue admin logs in once and grants the app access to their Page.
 *   3. Store the long-lived Page token here:
 *      FACEBOOK_PAGES='[{"pageId":"123","token":"EAAB...","venue":"Paddy's Brewpub"}]'
 *
 * Status: written against the documented Graph API shape but untested until a
 * venue grants a token. Most venues that only post on Facebook are better
 * served by the manual/submission source for now.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

interface FbEvent {
  id: string;
  name: string;
  description?: string;
  start_time: string; // "2026-11-14T20:00:00-0400"
  end_time?: string;
  is_canceled?: boolean;
  ticket_uri?: string;
  cover?: { source?: string };
  place?: { name?: string; location?: { street?: string; city?: string; state?: string; latitude?: number; longitude?: number } };
}

/** Graph API offsets come as "-0400"; make them ISO "-04:00". */
const isoOffset = (s: string) => s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

export function mapFacebookEvent(e: FbEvent, fallbackVenue?: string): RawEvent | null {
  if (e.is_canceled) return null;
  const loc = e.place?.location;
  if (loc?.state && !/^(ns|nova scotia)$/i.test(loc.state)) return null;
  return {
    sourceId: "facebook-pages",
    sourceUrl: `https://www.facebook.com/events/${e.id}/`,
    title: e.name,
    venueName: e.place?.name ?? fallbackVenue ?? "",
    address: loc?.street,
    city: loc?.city,
    latitude: loc?.latitude,
    longitude: loc?.longitude,
    date: isoOffset(e.start_time),
    endTime: e.end_time?.slice(11, 16),
    description: truncate(e.description ?? ""),
    ticketUrl: e.ticket_uri,
    imageUrl: e.cover?.source,
    verified: true, // the venue's own Page
  };
}

function pages(): { pageId: string; token: string; venue?: string }[] {
  try {
    return JSON.parse(process.env.FACEBOOK_PAGES ?? "[]");
  } catch {
    console.warn("[facebook-pages] FACEBOOK_PAGES is not valid JSON");
    return [];
  }
}

export const facebookPagesSource: Source = {
  id: "facebook-pages",
  name: "Facebook venue Pages (Graph API, venue-granted)",
  kind: "facebook",
  termsNote: "Graph API with Page tokens granted by each venue. Never scrapes facebook.com.",
  enabled: () => pages().length > 0,
  async fetch() {
    const out: RawEvent[] = [];
    for (const p of pages()) {
      const qs = new URLSearchParams({
        time_filter: "upcoming",
        fields: "id,name,description,start_time,end_time,is_canceled,ticket_uri,cover,place",
        access_token: p.token,
      });
      try {
        const res = await fetch(`${GRAPH}/${p.pageId}/events?${qs}`);
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const body = (await res.json()) as { data: FbEvent[] };
        for (const e of body.data) {
          const r = mapFacebookEvent(e, p.venue);
          if (r) out.push(r);
        }
      } catch (err) {
        console.warn(`[facebook-pages] page ${p.pageId}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};
