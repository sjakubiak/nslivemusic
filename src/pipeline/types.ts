/**
 * What a scraper hands to the pipeline: loosely-typed strings straight off a
 * page or API. Normalisation turns these into the app's MusicEvent model.
 */
export interface RawEvent {
  sourceId: string;
  sourceUrl: string;
  title: string;
  venueName: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  /** Any reasonable date form: "2026-11-14", "Nov 14, 2026", "Friday, November 14", ISO datetime. */
  date: string;
  /** "8pm", "8:30 PM", "20:00". Ignored if `date` already carries a time. */
  startTime?: string;
  endTime?: string;
  description?: string;
  /** Free-text category from the source, e.g. "Open Mic Night", "Trad session". */
  category?: string;
  genres?: string[];
  /** "$10", "Free", "PWYC", "10.00" */
  cover?: string;
  website?: string;
  ticketUrl?: string;
  imageUrl?: string;
  /** Venue-run or official API sources are considered verified. */
  verified?: boolean;
}

export interface Source {
  id: string;
  name: string;
  kind: "venue-website" | "listing-site" | "facebook" | "sample";
  /**
   * How we're allowed to collect from this source. Every non-sample source
   * must document this before being enabled (robots.txt, ToS, API terms).
   */
  termsNote: string;
  enabled: () => boolean;
  fetch: () => Promise<RawEvent[]>;
}
