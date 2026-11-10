import type { RawEvent, Source } from "../types";
import { addDays, nsDayKey, nsWeekday } from "../../lib/time";
import { HORIZON_DAYS } from "./ical";
import { liveListings, loadSeeds } from "../../lib/listings";

/**
 * Hand-entered events: the practical route for venues that only post on
 * Facebook/Instagram or a chalkboard, and for venues that email or message
 * their schedule in. Edit data/manual-events.json (one-off shows or weekly
 * recurring nights). Every entry records where it was confirmed and when, so
 * stale recurring nights can be re-checked.
 */
export interface ManualEntry {
  title: string;
  venue: string;
  address?: string;
  city: string;
  /** One-off: "2026-11-14". */
  date?: string;
  /** Recurring: weekdays, "SU".."SA". */
  weekly?: string[];
  /** Recurring: only every other week, counted from `from`. */
  biweekly?: boolean;
  /** Recurring: first and last dates the series runs (inclusive). */
  from?: string;
  until?: string;
  start: string; // "20:00" or "8pm"
  end?: string;
  category?: string;
  genres?: string[];
  cover?: string;
  description?: string;
  website?: string;
  ticketUrl?: string;
  /** Where the details were confirmed (venue post, email, phone call). */
  source: string;
  confirmedOn: string;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const STALE_DAYS = 90;

export function expandManual(entries: (ManualEntry & { listingId?: string })[], now = new Date()): RawEvent[] {
  const today = nsDayKey(now);
  const horizon = addDays(today, HORIZON_DAYS);
  const out: RawEvent[] = [];
  for (const e of entries) {
    let days: string[] = [];
    if (e.date) {
      if (e.date >= today && e.date <= horizon) days = [e.date];
    } else if (e.weekly?.length) {
      const wanted = e.weekly.map((d) => DAY_CODES.indexOf(d.toUpperCase()));
      const anchor = e.from ?? e.confirmedOn;
      const todayWd = nsWeekday(now);
      for (let i = 0; i <= HORIZON_DAYS; i++) {
        const day = addDays(today, i);
        if (e.from && day < e.from) continue;
        if (e.until && day > e.until) break;
        if (!wanted.includes((todayWd + i) % 7)) continue;
        if (e.biweekly) {
          const weeks = Math.floor((Date.parse(day) - Date.parse(anchor)) / (7 * 86_400_000));
          if (weeks % 2 !== 0) continue;
        }
        days.push(day);
      }
    }
    if (days.length && addDays(e.confirmedOn, STALE_DAYS) < today) {
      console.warn(`[manual] "${e.title}" at ${e.venue} was last confirmed ${e.confirmedOn}; re-check it`);
    }
    for (const day of days) {
      out.push({
        sourceId: "manual",
        sourceUrl: e.source,
        title: e.title,
        venueName: e.venue,
        address: e.address,
        city: e.city,
        date: day,
        startTime: e.start,
        endTime: e.end,
        description: e.description,
        category: e.category,
        genres: e.genres,
        cover: e.cover,
        website: e.website,
        ticketUrl: e.ticketUrl,
        verified: true,
        listingId: e.listingId,
      });
    }
  }
  return out;
}


export const manualSource: Source = {
  id: "manual",
  name: "Hand-entered and venue-submitted events",
  kind: "venue-website",
  termsNote: "Entered by us from venue posts/emails, or sent in by the venue.",
  // The database may hold nights even when the starter file is empty.
  enabled: () => loadSeeds().length > 0 || Boolean(process.env.SUPABASE_URL),
  async fetch() {
    const live = await liveListings();
    return expandManual(live.map((l) => ({ ...l.entry!, listingId: l.id })));
  },
};
