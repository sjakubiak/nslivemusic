import { isBlocked } from "./blocklist";
import crypto from "node:crypto";
import type { EventType, MusicEvent } from "../lib/types";
import { GENRES } from "../lib/types";
import { nsDayKey, nsLocalToUtc } from "../lib/time";
import type { RawEvent } from "./types";
import { findVenue } from "./venues";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Parse a scraped date into a Halifax "YYYY-MM-DD" day key.
 * Year-less dates ("Fri Nov 14") resolve to the next occurrence on/after `now`.
 */
export function normaliseDate(input: string, now = new Date()): string | null {
  const s = input.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1");

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // assume MM/DD/YYYY (North American)
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;

  m = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/);
  if (m && MONTHS.includes(m[1])) {
    const month = MONTHS.indexOf(m[1]) + 1;
    const day = Number(m[2]);
    const today = nsDayKey(now);
    let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    const key = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!m[3] && key(year) < today) year += 1;
    return key(year);
  }
  return null;
}

/** "8pm" / "8:30 PM" / "20:00" / "noon" → "HH:MM" (24h). */
export function normaliseTime(input?: string): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase().replace(/\./g, "");
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.[0];
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Map free-text source categories onto the app's four event types. */
export function normaliseEventType(category = "", title = ""): EventType {
  const s = `${category} ${title}`.toLowerCase();
  if (/karaoke/.test(s)) return "KARAOKE";
  if (/open[\s-]?mic|open stage|songwriters'? circle|singaround/.test(s)) return "OPEN_MIC";
  if (/\bjam\b|session|kitchen party|ceilidh session|trad session/.test(s)) return "JAM_SESSION";
  return "LIVE_MUSIC";
}

const GENRE_ALIASES: Record<string, string> = {
  trad: "Celtic",
  traditional: "Celtic",
  "east coast": "Celtic",
  fiddle: "Celtic",
  irish: "Celtic",
  scottish: "Celtic",
  americana: "Country",
  bluegrass: "Country",
  roots: "Folk",
  acoustic: "Folk",
  singer: "Folk",
  "singer-songwriter": "Folk",
  indie: "Rock",
  punk: "Rock",
  metal: "Rock",
  "r&b": "Blues",
  swing: "Jazz",
};

export function normaliseGenres(genres: string[] = []): string[] {
  const out = new Set<string>();
  for (const g of genres) {
    const k = g.trim().toLowerCase();
    const canonical = GENRES.find((x) => x.toLowerCase() === k) ?? GENRE_ALIASES[k];
    if (canonical) out.add(canonical);
  }
  return [...out];
}

/** "$10" → 10, "Free"/"PWYC" → 0, unknown → undefined. */
export function normaliseCover(cover?: string): number | undefined {
  if (!cover) return undefined;
  const s = cover.trim().toLowerCase();
  if (/free|no cover|pwyc|pay what you can|donation/.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : undefined;
}

const STREET_ABBREV: [RegExp, string][] = [
  [/\bst\.?$/i, "Street"],
  [/\bst\.?(?=,)/i, "Street"],
  [/\bave\.?\b/i, "Avenue"],
  [/\brd\.?\b/i, "Road"],
  [/\bhwy\.?\b/i, "Highway"],
  [/\bdr\.?\b/i, "Drive"],
  [/\bblvd\.?\b/i, "Boulevard"],
];

/** Strip city/province/postal code tails and expand common abbreviations. */
export function normaliseAddress(address = "", city = ""): string {
  let a = address.replace(/\s+/g, " ").trim();
  // Drop ", Halifax, NS B3J 1S5" style tails — city/province live in their own fields.
  a = a.replace(/,?\s*(nova scotia|n\.?s\.?)\b.*$/i, "");
  if (city) a = a.replace(new RegExp(`,?\\s*${city}\\s*$`, "i"), "");
  for (const [re, rep] of STREET_ABBREV) a = a.replace(re, rep);
  return a.replace(/,\s*$/, "").trim();
}

/** Links shown to users: http(s) only, never a blocked site. */
export function safeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol) || isBlocked(u)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function stableId(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 12);
}

/**
 * RawEvent → MusicEvent. Returns null (and the reason) for events that can't
 * be placed on the map or the calendar.
 */
export function normaliseEvent(raw: RawEvent, now = new Date()): { event: MusicEvent | null; reason?: string } {
  const venue = findVenue(raw.venueName, raw.city);
  const latitude = raw.latitude ?? venue?.latitude;
  const longitude = raw.longitude ?? venue?.longitude;
  if (latitude == null || longitude == null) return { event: null, reason: `no coordinates for venue "${raw.venueName}"` };
  // Auto-discovered feeds can include touring dates elsewhere: keep Nova Scotia only.
  if (latitude < 43.3 || latitude > 47.1 || longitude < -66.5 || longitude > -59.6) {
    return { event: null, reason: `outside Nova Scotia: "${raw.title}" at ${raw.venueName}` };
  }

  // ISO datetime with an explicit offset wins; otherwise date + local time.
  let start: Date | null = null;
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw.date) && /(z|[+-]\d{2}:?\d{2})$/i.test(raw.date.trim())) {
    start = new Date(raw.date);
  } else {
    const day = normaliseDate(raw.date, now);
    const isoTime = raw.date.match(/T(\d{2}:\d{2})/)?.[1];
    const time = normaliseTime(raw.startTime) ?? isoTime ?? null;
    if (!day) return { event: null, reason: `unparseable date "${raw.date}"` };
    if (!time) return { event: null, reason: `missing start time for "${raw.title}"` };
    start = nsLocalToUtc(day, time);
  }
  if (Number.isNaN(start.getTime())) return { event: null, reason: `invalid date "${raw.date}"` };

  let end: Date | undefined;
  const endTime = normaliseTime(raw.endTime);
  if (endTime) {
    end = nsLocalToUtc(nsDayKey(start), endTime);
    if (end.getTime() === start.getTime()) end = undefined; // feeds often repeat the start as the end
    else if (end < start) end = new Date(end.getTime() + 24 * 3600_000); // runs past midnight
  }

  const city = venue?.city ?? raw.city?.trim() ?? "";
  const venueName = venue?.name ?? raw.venueName.trim();
  const title = raw.title.replace(/\s+/g, " ").trim();

  return {
    event: {
      id: stableId([venueName, start.toISOString(), title]),
      title,
      venueName,
      address: normaliseAddress(raw.address ?? venue?.address, city),
      city,
      province: "NS",
      latitude,
      longitude,
      startDateTime: start.toISOString(),
      endDateTime: end?.toISOString(),
      description: (raw.description ?? "").trim(),
      eventType: raw.eventType ?? normaliseEventType(raw.category, title),
      genre: normaliseGenres(raw.genres),
      coverCharge: normaliseCover(raw.cover),
      website: safeUrl(raw.website) ?? venue?.website,
      ticketUrl: safeUrl(raw.ticketUrl),
      imageUrl: safeUrl(raw.imageUrl),
      sourceUrl: safeUrl(raw.sourceUrl) ?? "",
      verified: raw.verified ?? false,
      ...(raw.listingId ? { listingId: raw.listingId } : {}),
      lastUpdated: now.toISOString(),
    },
  };
}
