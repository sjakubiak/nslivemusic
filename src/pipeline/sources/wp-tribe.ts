import type { RawEvent, Source } from "../types";
import type { Feed } from "../feeds";
import { FEEDS, feedEnabled } from "../feeds";
import { politeFetch } from "../polite-fetch";
import { addDays, nsDayKey } from "../../lib/time";
import { decodeEntities, htmlToText, truncate } from "../text";
import { HORIZON_DAYS } from "./ical";

/**
 * WordPress sites running The Events Calendar (very common for NS venues and
 * community calendars) expose a JSON API at /wp-json/tribe/events/v1/events.
 * It's richer than the iCal export (venue address + coordinates, cost, image),
 * but some sites block /wp-json in robots.txt; politeFetch refuses those and
 * you fall back to the same site's "?ical=1" feed.
 */
interface TribeVenue {
  venue?: string;
  address?: string;
  city?: string;
  province?: string;
  geo_lat?: number | string;
  geo_lng?: number | string;
  website?: string;
}
export interface TribeEvent {
  title: string;
  description?: string;
  url: string;
  utc_start_date?: string; // "2026-11-15 00:00:00"
  start_date: string; // local, "2026-11-14 20:00:00"
  end_date?: string;
  all_day?: boolean;
  cost?: string;
  website?: string;
  image?: { url?: string } | false;
  venue?: TribeVenue | [];
  categories?: { name: string }[];
  tags?: { name: string }[];
}

export function mapTribeEvent(e: TribeEvent, feed: Pick<Feed, "id" | "venue">): RawEvent | null {
  if (e.all_day) return null; // no start time to show
  const v: TribeVenue = Array.isArray(e.venue) ? {} : e.venue ?? {};
  const cats = [...(e.categories ?? []), ...(e.tags ?? [])].map((c) => decodeEntities(c.name));
  const lat = v.geo_lat != null && v.geo_lat !== "" ? Number(v.geo_lat) : undefined;
  const lng = v.geo_lng != null && v.geo_lng !== "" ? Number(v.geo_lng) : undefined;
  return {
    sourceId: feed.id,
    sourceUrl: e.url,
    title: decodeEntities(e.title),
    venueName: decodeEntities(v.venue ?? feed.venue?.name ?? ""),
    address: v.address ? decodeEntities(v.address) : feed.venue?.address,
    city: v.city ?? feed.venue?.city,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    date: e.utc_start_date ? `${e.utc_start_date.replace(" ", "T")}Z` : e.start_date.slice(0, 10),
    startTime: e.utc_start_date ? undefined : e.start_date.slice(11, 16),
    endTime: e.end_date?.slice(11, 16),
    description: truncate(htmlToText(e.description)),
    category: cats.join(", ") || undefined,
    genres: cats,
    cover: e.cost || undefined,
    website: v.website || e.website || undefined,
    ticketUrl: e.website || undefined,
    imageUrl: e.image ? e.image.url : undefined,
    verified: Boolean(feed.venue),
  };
}

export const wpTribeSource: Source = {
  id: "wp-tribe",
  name: "WordPress event calendars (The Events Calendar API)",
  kind: "listing-site",
  termsNote: "Only feeds in feeds.ts with permission granted; robots.txt enforced by politeFetch.",
  enabled: () => FEEDS.some((f) => f.kind === "wp-tribe" && feedEnabled(f)),
  async fetch() {
    const out: RawEvent[] = [];
    const today = nsDayKey(new Date());
    for (const f of FEEDS.filter((f) => f.kind === "wp-tribe" && feedEnabled(f))) {
      const base = f.url.replace(/\/$/, "");
      let next: string | undefined =
        `${base}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}&end_date=${addDays(today, HORIZON_DAYS)}`;
      try {
        for (let page = 0; next && page < 10; page++) {
          const body = JSON.parse(await politeFetch(next)) as { events: TribeEvent[]; next_rest_url?: string };
          for (const e of body.events) {
            const r = mapTribeEvent(e, f);
            if (r) out.push(r);
          }
          next = body.next_rest_url;
        }
      } catch (err) {
        console.warn(`[wp-tribe] ${f.id}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};
