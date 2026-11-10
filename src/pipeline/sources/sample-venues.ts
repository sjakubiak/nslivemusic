import type { RawEvent, Source } from "../types";
import { VENUES } from "../venues";
import { addDays, nsDayKey, nsWeekday } from "../../lib/time";

const DAYS_AHEAD = 28;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/** Small deterministic PRNG so the sample data is stable for a given week. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

/**
 * Stand-in for real venue-website scrapers: produces what a venue's own
 * "What's On" page would yield, with deliberately mixed date/time formats so
 * the normaliser gets exercised. Marked verified (venue is the source).
 */
export const sampleVenueSource: Source = {
  id: "sample-venues",
  name: "Sample venue websites",
  kind: "sample",
  termsNote: "Generated locally; no network access.",
  enabled: () => true,
  async fetch() {
    const now = new Date();
    const today = nsDayKey(now);
    const weekdayToday = nsWeekday(now);
    const out: RawEvent[] = [];

    VENUES.forEach((v, vi) => {
      const rand = rng(vi * 7919 + Number(today.slice(5, 7)));
      for (let i = 0; i < DAYS_AHEAD; i++) {
        const day = addDays(today, i);
        const wd = (weekdayToday + i) % 7;
        const [y, m, d] = day.split("-").map(Number);
        const weekNo = Math.floor(i / 7);

        for (const w of v.weekly) {
          if (w.weekday !== wd) continue;
          if (w.biweekly && weekNo % 2 === 1) continue;
          // Alternate formats like real sites do.
          const fmt = (vi + i) % 3;
          out.push({
            sourceId: "sample-venues",
            sourceUrl: `${v.website}/events`,
            title: w.title,
            venueName: v.name,
            address: `${v.address}, ${v.city}, NS`,
            city: v.city,
            date: fmt === 0 ? day : fmt === 1 ? `${MONTH_NAMES[m - 1]} ${d}, ${y}` : `${m}/${d}/${y}`,
            startTime: fmt === 2 ? w.start : to12h(w.start),
            endTime: w.end ? to12h(w.end) : undefined,
            description: w.description,
            category: w.category,
            genres: w.genres,
            cover: w.cover,
            website: v.website,
            verified: true,
          });
        }

        // One-off headline shows on Fri/Sat at venues with an act roster.
        if (v.acts?.length && (wd === 5 || wd === 6) && !v.weekly.some((w) => w.weekday === wd) && rand() < 0.75) {
          const act = v.acts[Math.floor(rand() * v.acts.length)];
          out.push({
            sourceId: "sample-venues",
            sourceUrl: `${v.website}/events`,
            title: `${act.name} Live`,
            venueName: v.name,
            address: `${v.address}, ${v.city}, NS`,
            city: v.city,
            date: day,
            startTime: wd === 5 ? "9pm" : "8:30pm",
            endTime: "12am",
            description: `${act.blurb} Doors open 30 minutes before showtime.`,
            category: "concert",
            genres: act.genres,
            cover: act.cover,
            website: v.website,
            ticketUrl: act.cover ? `${v.website}/tickets` : undefined,
            verified: true,
          });
        }
      }
    });
    return out;
  },
};
