import type { MusicEvent } from "../lib/types";
import { distanceKm } from "../lib/geo";
import { normaliseVenueName } from "./venues";

/**
 * Deduplication rules.
 *
 * The spec was cut off after "Events are duplicates when: Same venue", so the
 * remaining rules are our assumption. Two events are duplicates when ALL of:
 *
 *   1. Same venue — normalised venue names match, OR the coordinates are
 *      within VENUE_RADIUS_KM of each other (handles "The Rusty Anchor" vs
 *      "Rusty Anchor Pub").
 *   2. Same start — start times are within START_WINDOW_MIN minutes
 *      (sources often round, or list doors vs. show time).
 *   3. Similar title — token Jaccard similarity >= TITLE_SIMILARITY, OR one
 *      title contains the other, OR both are the same event type and the
 *      starts are within 30 minutes (a venue rarely runs two open mics at once).
 */
export const VENUE_RADIUS_KM = 0.075;
export const START_WINDOW_MIN = 90;
export const TITLE_SIMILARITY = 0.5;

const STOP = new Set(["the", "a", "an", "at", "with", "and", "night", "live", "music", "w", "presents", "ft", "feat"]);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOP.has(t)),
  );
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function sameVenue(a: MusicEvent, b: MusicEvent): boolean {
  if (normaliseVenueName(a.venueName) === normaliseVenueName(b.venueName)) return true;
  return distanceKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }) <= VENUE_RADIUS_KM;
}

export function isDuplicate(a: MusicEvent, b: MusicEvent): boolean {
  // Two different hand-entered nights are distinct on purpose (e.g. two rooms of one hotel).
  if (a.listingId && b.listingId && a.listingId !== b.listingId) return false;
  if (!sameVenue(a, b)) return false;
  const diffMin = Math.abs(Date.parse(a.startDateTime) - Date.parse(b.startDateTime)) / 60_000;
  if (diffMin > START_WINDOW_MIN) return false;

  const ta = a.title.toLowerCase();
  const tb = b.title.toLowerCase();
  if (ta.includes(tb) || tb.includes(ta)) return true;
  if (titleSimilarity(a.title, b.title) >= TITLE_SIMILARITY) return true;
  return a.eventType === b.eventType && diffMin <= 30;
}

/** Field-completeness score used to pick which record wins a merge. */
function score(e: MusicEvent): number {
  return (
    (e.verified ? 100 : 0) +
    [e.endDateTime, e.coverCharge, e.website, e.ticketUrl, e.imageUrl].filter((x) => x != null).length +
    (e.genre?.length ?? 0) +
    Math.min(e.description.length / 100, 3)
  );
}

/** Merge b into a: keep the stronger record's fields, fill gaps from the other. */
export function mergeEvents(a: MusicEvent, b: MusicEvent): MusicEvent {
  const [primary, secondary] = score(a) >= score(b) ? [a, b] : [b, a];
  const merged: MusicEvent = { ...secondary, ...stripUndefined(primary) };
  merged.genre = [...new Set([...(primary.genre ?? []), ...(secondary.genre ?? [])])];
  if (secondary.description.length > primary.description.length * 1.5) merged.description = secondary.description;
  merged.verified = a.verified || b.verified;
  merged.lastUpdated = [a.lastUpdated, b.lastUpdated].sort().at(-1)!;
  return merged;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

export function dedupe(events: MusicEvent[]): { events: MusicEvent[]; merged: number } {
  const sorted = [...events].sort((x, y) => Date.parse(x.startDateTime) - Date.parse(y.startDateTime));
  const out: MusicEvent[] = [];
  let merged = 0;
  for (const e of sorted) {
    // Only compare against events that start within the window (list is sorted).
    const idx = out.findIndex(
      (o) => Date.parse(e.startDateTime) - Date.parse(o.startDateTime) <= START_WINDOW_MIN * 60_000 && isDuplicate(o, e),
    );
    if (idx >= 0) {
      out[idx] = mergeEvents(out[idx], e);
      merged++;
    } else out.push(e);
  }
  return { events: out, merged };
}
