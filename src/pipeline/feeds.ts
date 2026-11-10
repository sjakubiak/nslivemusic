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

export const FEEDS: Feed[] = [
  {
    id: "livemusichalifax-ical",
    name: "Live Music Halifax (community calendar)",
    kind: "ical",
    url: "https://livemusichalifax.ca/events/month/{month}/?ical=1",
    region: "Halifax / Dartmouth",
    defaultCity: "Halifax",
    permission: "pending",
    note:
      "WordPress + The Events Calendar; publishes an iCal export. Best single source for HRM " +
      "(Bearly's, The Local, Lion's Head, Economy Shoe Shop, Music Room…). Ask the curator before enabling.",
  },
];

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
