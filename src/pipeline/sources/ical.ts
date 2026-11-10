import type { RawEvent, Source } from "../types";
import type { Feed } from "../feeds";
import { allFeeds, feedEnabled, feedUrls } from "../feeds";
import { politeFetch } from "../polite-fetch";
import { addDays, nsDayKey } from "../../lib/time";
import { htmlToText, truncate } from "../text";

/**
 * iCalendar (.ics) feeds: the most widely available machine-readable format
 * for venue and community calendars (Google Calendar "public address in iCal
 * format", WordPress The Events Calendar "?ical=1", Squarespace, Tockify…).
 *
 * Handles line folding, escapes, TZID/UTC/floating/all-day DTSTART, GEO,
 * EXDATE, RECURRENCE-ID overrides and the RRULEs venues actually use
 * (DAILY, WEEKLY with BYDAY/INTERVAL, MONTHLY with BYDAY "2TU"/"-1FR" or
 * BYMONTHDAY; UNTIL and COUNT). Times with a TZID are treated as Halifax
 * local time (every NS feed we've seen uses America/Halifax). Recurrences
 * are expanded in Halifax wall-clock time, so a weekly 9 pm stays 9 pm across
 * DST; a UTC-anchored RRULE whose UTC day differs from the local day (rare in
 * practice: Google and WordPress export recurring events with a TZID) would
 * land a day off.
 */

export const HORIZON_DAYS = 42;

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}
type VEvent = Map<string, Prop[]>;

/** Unfold and split into VEVENT property maps. */
export function parseVEvents(ics: string): VEvent[] {
  const lines = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: VEvent[] = [];
  let cur: VEvent | null = null;
  let depth = 0; // skip nested VALARM etc.
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = new Map();
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("BEGIN:")) depth++;
    else if (line.startsWith("END:") && line !== "END:VEVENT") depth--;
    else if (line === "END:VEVENT") {
      out.push(cur);
      cur = null;
    } else if (depth === 0) {
      const p = parseProp(line);
      if (p) cur.set(p.name, [...(cur.get(p.name) ?? []), p]);
    }
  }
  return out;
}

function parseProp(line: string): Prop | null {
  // NAME;PARAM=a;PARAM2="b:c":value — the first ':' outside quotes splits.
  let inQuote = false;
  let i = 0;
  for (; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ":" && !inQuote) break;
  }
  if (i >= line.length) return null;
  const [name, ...paramParts] = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const pp of paramParts) {
    const [k, v = ""] = pp.split("=");
    params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

export function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

const hhmmFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** A DTSTART/DTEND/EXDATE value → Halifax local { day, time? }. */
export function icsLocal(p: Prop | undefined): { day: string; time?: string } | null {
  if (!p) return null;
  const m = p.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return { day }; // VALUE=DATE (all-day)
  if (m[7]) {
    const d = new Date(`${day}T${m[4]}:${m[5]}:${m[6] ?? "00"}Z`);
    return { day: nsDayKey(d), time: hhmmFmt.format(d) };
  }
  return { day, time: `${m[4]}:${m[5]}` };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const dayNum = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86_400_000;
const weekdayOf = (key: string) => new Date(dayNum(key) * 86_400_000).getUTCDay();

/** Expand an RRULE into local day keys within [from, to]. */
export function expandRRule(rule: string, startDay: string, from: string, to: string): string[] {
  const r: Record<string, string> = Object.fromEntries(rule.split(";").map((kv) => kv.split("=") as [string, string]));
  const freq = r.FREQ;
  const interval = Number(r.INTERVAL ?? 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? icsLocal({ name: "UNTIL", params: {}, value: r.UNTIL })?.day : undefined;
  const byDay = r.BYDAY?.split(",") ?? [];
  const byMonthDay = r.BYMONTHDAY?.split(",").map(Number) ?? [];
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(freq)) return [];

  const startNum = dayNum(startDay);
  const startMonday = startNum - ((weekdayOf(startDay) + 6) % 7);
  const startMonthIdx = +startDay.slice(0, 4) * 12 + +startDay.slice(5, 7) - 1;

  const matches = (key: string): boolean => {
    const n = dayNum(key);
    const wd = weekdayOf(key);
    if (freq === "DAILY") return (n - startNum) % interval === 0;
    if (freq === "WEEKLY") {
      const days = byDay.length ? byDay.map((c) => DAY_CODES.indexOf(c.slice(-2))) : [weekdayOf(startDay)];
      return days.includes(wd) && Math.floor((n - startMonday) / 7) % interval === 0;
    }
    // MONTHLY
    const monthIdx = +key.slice(0, 4) * 12 + +key.slice(5, 7) - 1;
    if ((monthIdx - startMonthIdx) % interval !== 0) return false;
    const dom = +key.slice(8, 10);
    if (byMonthDay.length) return byMonthDay.includes(dom);
    if (!byDay.length) return dom === +startDay.slice(8, 10);
    const daysInMonth = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();
    return byDay.some((c) => {
      const m = c.match(/^([+-]?\d)?([A-Z]{2})$/);
      if (!m || DAY_CODES.indexOf(m[2]) !== wd) return false;
      if (!m[1]) return true;
      const nth = Number(m[1]);
      return nth > 0 ? Math.ceil(dom / 7) === nth : Math.ceil((daysInMonth - dom + 1) / 7) === -nth;
    });
  };

  const out: string[] = [];
  let seen = 0;
  for (let key = startDay; key <= to; key = addDays(key, 1)) {
    if (until && key > until) break;
    if (!matches(key)) continue;
    if (++seen > count) break;
    if (key >= from) out.push(key);
  }
  return out;
}

const MUSIC_RE = /music|band|concert|open[\s-]?mic|jam|karaoke|ceilidh|fiddle|session|songwriter|acoustic|jazz|blues|folk|rock|country|celtic|dj|trio|duo|quartet|live/i;

/** Parse an .ics document into RawEvents for the next HORIZON_DAYS days. */
export function parseIcs(ics: string, feed: Pick<Feed, "id" | "url" | "venue" | "musicOnly" | "defaultCity">, now = new Date()): RawEvent[] {
  const today = nsDayKey(now);
  const horizon = addDays(today, HORIZON_DAYS);
  const vevents = parseVEvents(ics);

  // RECURRENCE-ID instances replace the generated occurrence on that day.
  const overridden = new Set<string>();
  for (const ev of vevents) {
    const rid = icsLocal(ev.get("RECURRENCE-ID")?.[0]);
    const uid = ev.get("UID")?.[0]?.value;
    if (rid && uid) overridden.add(`${uid}|${rid.day}`);
  }

  const out: RawEvent[] = [];
  for (const ev of vevents) {
    const get = (k: string) => ev.get(k)?.[0]?.value;
    if (/CANCELLED/i.test(get("STATUS") ?? "")) continue;
    const start = icsLocal(ev.get("DTSTART")?.[0]);
    if (!start) continue;
    const end = icsLocal(ev.get("DTEND")?.[0]);
    const title = unescapeText(get("SUMMARY") ?? "").trim();
    const description = truncate(htmlToText(unescapeText(get("DESCRIPTION") ?? "")));
    const categories = (ev.get("CATEGORIES") ?? []).map((p) => unescapeText(p.value)).join(", ");
    if (!title) continue;
    if (feed.musicOnly && !MUSIC_RE.test(`${title} ${categories} ${description}`)) continue;

    const uid = get("UID");
    const isOverride = Boolean(ev.get("RECURRENCE-ID"));
    const exdates = new Set(
      (ev.get("EXDATE") ?? []).flatMap((p) => p.value.split(",").map((v) => icsLocal({ ...p, value: v })?.day).filter(Boolean) as string[]),
    );
    const rrule = get("RRULE");
    const days = rrule && !isOverride
      ? expandRRule(rrule, start.day, today, horizon).filter((d) => !exdates.has(d) && !overridden.has(`${uid}|${d}`))
      : start.day >= today && start.day <= horizon
        ? [start.day]
        : [];

    const loc = parseLocation(unescapeText(get("LOCATION") ?? ""), feed.venue);
    const geo = get("GEO")?.split(";").map(Number);
    const url = get("URL");
    for (const day of days) {
      out.push({
        sourceId: feed.id,
        sourceUrl: url ?? feed.url,
        title,
        venueName: loc.venueName,
        address: loc.address,
        city: loc.city ?? feed.defaultCity,
        latitude: geo && Number.isFinite(geo[0]) ? geo[0] : undefined,
        longitude: geo && Number.isFinite(geo[1]) ? geo[1] : undefined,
        date: day,
        startTime: start.time,
        endTime: end?.time,
        description,
        category: categories || undefined,
        genres: categories ? categories.split(/,\s*/) : undefined,
        website: url,
        imageUrl: ev.get("ATTACH")?.find((p) => /^image\//.test(p.params.FMTTYPE ?? ""))?.value,
        verified: Boolean(feed.venue), // a venue's own calendar
      });
    }
  }
  return out;
}

/**
 * "Bearly's House of Blues & Ribs, 1579 Grafton St, Halifax, NS, B3J 2C3, Canada"
 * → venue / address / city. Falls back to the feed's venue for single-venue calendars.
 */
export function parseLocation(location: string, fallback?: Feed["venue"]): { venueName: string; address?: string; city?: string } {
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean)
    .filter((p) => !/^(canada|ns|nova scotia|[a-z]\d[a-z]\s?\d[a-z]\d)$/i.test(p));
  if (!parts.length) return { venueName: fallback?.name ?? "", address: fallback?.address, city: fallback?.city };
  const startsWithNumber = /^\d/.test(parts[0]);
  if (fallback && (startsWithNumber || parts.length === 1)) {
    return { venueName: fallback.name, address: startsWithNumber ? parts[0] : fallback.address, city: parts[1] ?? fallback.city };
  }
  return { venueName: parts[0], address: parts[1], city: parts[2] ?? fallback?.city };
}

export const icalSource: Source = {
  id: "ical",
  name: "iCalendar feeds (venue & community calendars)",
  kind: "listing-site",
  termsNote: "Only feeds in feeds.ts with permission granted; robots.txt enforced by politeFetch.",
  enabled: () => allFeeds().some((f) => f.kind === "ical" && feedEnabled(f)),
  async fetch() {
    const out: RawEvent[] = [];
    for (const f of allFeeds().filter((f) => f.kind === "ical" && feedEnabled(f))) {
      for (const url of feedUrls(f)) {
        try {
          const events = parseIcs(await politeFetch(url), f);
          console.log(`[ical] ${f.id}: ${events.length} upcoming from ${url}`);
          out.push(...events); // month exports overlap at most on recurring series; dedup merges those
        } catch (err) {
          console.warn(`[ical] ${f.id} ${url}: ${(err as Error).message}`);
        }
      }
    }
    return out;
  },
};
