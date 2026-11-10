import type { RawEvent, Source } from "../types";
import { sampleVenueSource } from "./sample-venues";

/**
 * Stand-in for a community-calendar / listing-site scraper. It re-lists a
 * subset of the venue events the way aggregators do — different title
 * wording, venue name without "The", a time rounded or 30 min early (doors),
 * less detail, unverified — so the dedup stage has real work to do.
 */
export const sampleListingSource: Source = {
  id: "sample-listing",
  name: "Sample community calendar",
  kind: "sample",
  termsNote: "Generated locally; no network access.",
  enabled: () => true,
  async fetch() {
    const venueEvents = await sampleVenueSource.fetch();
    const out: RawEvent[] = [];
    venueEvents.forEach((e, i) => {
      if (i % 3 !== 0) return;
      out.push({
        ...e,
        sourceId: "sample-listing",
        sourceUrl: "https://example.com/community-calendar",
        title: i % 2 ? `${e.title} at ${e.venueName.replace(/^The /, "")}` : e.title.toUpperCase(),
        venueName: e.venueName.replace(/^The /, ""),
        startTime: i % 4 === 0 && e.startTime ? shiftEarlier(e.startTime) : e.startTime,
        endTime: undefined,
        description: "Listed on the community calendar.",
        ticketUrl: undefined,
        verified: false,
      });
    });
    return out;
  },
};

/** "9pm" → "8:30pm" (doors time), "20:00" → "19:30". */
function shiftEarlier(t: string): string {
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!m) return t;
  let h = Number(m[1]);
  let min = Number(m[2] ?? 0) - 30;
  if (min < 0) {
    min += 60;
    h -= 1;
  }
  return m[3] ? `${h}:${String(min).padStart(2, "0")}${m[3]}` : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
