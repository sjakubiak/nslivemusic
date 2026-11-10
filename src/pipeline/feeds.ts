/**
 * Real event feeds. Each one is OFF until `permission` is "granted", i.e. the
 * site owner said yes (or the feed is our own / the venue's own export they
 * asked us to use). To try a pending feed locally without flipping it, set
 * ENABLE_FEEDS=<id>,<id>.
 *
 * Why ask first even when a feed is public? An iCal/RSS export is offered for
 * people to subscribe in their own calendar; republishing a curator's whole
 * listing in another app is a different use, and asking costs one email.
 * See docs/SOURCES.md for the outreach list and the email template.
 */
import { nsDayKey } from "../lib/time";
import { loadDiscovered } from "../discovery/store";
import { stableId } from "./normalize";
import { NS_VENUES } from "./venues-ns";
import { isBlocked } from "./blocklist";

export type FeedKind =
  /** iCalendar (.ics) export: Google Calendar public URL, WordPress "?ical=1", Squarespace, etc. */
  | "ical"
  /** WordPress + The Events Calendar REST API (/wp-json/tribe/events/v1/events). */
  | "wp-tribe"
  /** Venue page with schema.org Event JSON-LD (Squarespace, Wix, many WP plugins). */
  | "jsonld";

export interface Feed {
  id: string;
  name: string;
  kind: FeedKind;
  /**
   * Feed URL. "{month}" is replaced with this month and next ("2026-11",
   * "2026-12") and both are fetched: WordPress list-view exports only hold one
   * page of events, month-view exports hold the whole month.
   */
  url: string;
  region: string;
  permission: "granted" | "pending";
  /** Who said yes and when, or what we're waiting on. */
  note: string;
  /** For single-venue feeds whose events don't repeat the venue/address. */
  venue?: { name: string; address?: string; city: string };
  /** Town to assume when an event's location has no city ("The Music Room, 6181 Lady Hammond Road"). */
  defaultCity?: string;
  /** Feed covers more than music (e.g. a town calendar): keep only music-looking events. */
  musicOnly?: boolean;
}

export const FEEDS: Feed[] = [];

export { BLOCKED_HOSTS, isBlocked } from "./blocklist";

/**
 * Hand-listed feeds plus everything the auto-finder discovered on venue and
 * listing sites (data/discovered.json). Discovered feeds are published by the
 * site itself for calendar apps to subscribe to, so they're on by default; set
 * DISABLE_DISCOVERED=1 to ignore them.
 */
export function allFeeds(): Feed[] {
  const known = new Set(FEEDS.map((f) => hostOf(f.url)));
  const discovered: Feed[] = process.env.DISABLE_DISCOVERED
    ? []
    : pickOnePerSite(loadDiscovered().feeds.map((f) => f.key).filter((u) => !isBlocked(u)))
        .filter((url) => !known.has(hostOf(url)))
        .map((url) => {
          const found = loadDiscovered().feeds.find((f) => f.key === url)!;
          const venue = venueForSite(found.foundOn);
          return {
            id: `auto-${stableId([url])}`,
            name: venue?.name ?? found.label ?? hostOf(url),
            kind: "ical" as const,
            url,
            region: "auto-discovered",
            permission: "granted" as const,
            note: `Found by the auto-finder on ${found.foundOn} (first seen ${found.firstSeen})`,
            // A venue's own calendar often leaves LOCATION blank: it's implied.
            venue: venue ? { name: venue.name, address: venue.address, city: venue.city } : undefined,
          };
        });
  return [...FEEDS, ...discovered];
}

/** "www.oldtriangle.com" and "oldtriangle.com" are one site. Google Calendar feeds are keyed by calendar. */
export function hostOf(url: string): string {
  const u = new URL(url);
  return u.hostname === "calendar.google.com" ? u.pathname : u.hostname.replace(/^www\./, "");
}

/**
 * WordPress sites expose the same events through several export URLs
 * (list, month, outlook variants). Keep one per site: the month export if
 * present, since it covers whole months, else the shortest URL.
 */
export function pickOnePerSite(urls: string[]): string[] {
  const bySite = new Map<string, string[]>();
  for (const u of urls) bySite.set(hostOf(u), [...(bySite.get(hostOf(u)) ?? []), u]);
  return [...bySite.values()].map((list) => list.find((u) => u.includes("{month}") && !u.includes("outlook")) ?? [...list].sort((a, b) => a.length - b.length)[0]);
}

/** The registry venue whose website is the site a feed was found on. */
export function venueForSite(pageUrl: string) {
  const host = hostOf(pageUrl);
  return NS_VENUES.find((v) => v.website && hostOf(v.website) === host);
}

export function feedUrls(f: Feed, now = new Date()): string[] {
  if (!f.url.includes("{month}")) return [f.url];
  const [y, m] = nsDayKey(now).split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return [`${y}-${String(m).padStart(2, "0")}`, next].map((mo) => f.url.replace("{month}", mo));
}

export function feedEnabled(f: Feed): boolean {
  const forced = (process.env.ENABLE_FEEDS ?? "").split(",").map((s) => s.trim());
  return f.permission === "granted" || forced.includes(f.id);
}
