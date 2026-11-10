import type { EventType, MusicEvent } from "./types";
import { EVENT_TYPE_LABEL } from "./types";
import { distanceKm, type LatLng } from "./geo";
import { addDays, nsDayKey, nsWeekday } from "./time";

export type DateFilter = "ALL" | "TODAY" | "TOMORROW" | "WEEKEND" | "NEXT_7" | "CUSTOM";
export type SortKey = "SOONEST" | "CLOSEST" | "ALPHA";

export interface EventQuery {
  search?: string;
  types?: EventType[]; // empty/undefined = all
  date?: DateFilter;
  from?: string; // YYYY-MM-DD (custom range)
  to?: string;
  radiusKm?: number; // requires origin
  genre?: string; // undefined / "All" = any
  origin?: LatLng;
  sort?: SortKey;
}

export interface EventWithDistance extends MusicEvent {
  distanceKm?: number;
}

/** Inclusive [from, to] Halifax day-key range for a date filter, or null for no limit. */
export function dateRange(filter: DateFilter, now: Date, from?: string, to?: string): [string, string] | null {
  const today = nsDayKey(now);
  switch (filter) {
    case "TODAY":
      return [today, today];
    case "TOMORROW":
      return [addDays(today, 1), addDays(today, 1)];
    case "NEXT_7":
      return [today, addDays(today, 6)];
    case "WEEKEND": {
      // Friday–Sunday of the current week; if it's already the weekend, the rest of it.
      const wd = nsWeekday(now);
      if (wd === 0) return [today, today];
      if (wd >= 5) return [today, addDays(today, 7 - wd)];
      return [addDays(today, 5 - wd), addDays(today, 7 - wd)];
    }
    case "CUSTOM":
      return [from || today, to || from || addDays(today, 365)];
    default:
      return null;
  }
}

function matchesSearch(e: MusicEvent, q: string): boolean {
  const hay = [e.title, e.venueName, e.city, e.address, EVENT_TYPE_LABEL[e.eventType], ...(e.genre ?? [])]
    .join(" ")
    .toLowerCase()
    .replace(/[’']/g, "");
  return q
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export function queryEvents(events: MusicEvent[], q: EventQuery, now = new Date()): EventWithDistance[] {
  const range = dateRange(q.date ?? "ALL", now, q.from, q.to);
  const nowMs = now.getTime();

  let out: EventWithDistance[] = events
    .filter((e) => {
      // Hide events that have finished (or started > 3h ago with no end time).
      const end = e.endDateTime ? Date.parse(e.endDateTime) : Date.parse(e.startDateTime) + 3 * 3600_000;
      return end >= nowMs;
    })
    .filter((e) => !q.types?.length || q.types.includes(e.eventType))
    .filter((e) => !q.genre || q.genre === "All" || (e.genre ?? []).some((g) => g.toLowerCase() === q.genre!.toLowerCase()))
    .filter((e) => {
      if (!range) return true;
      const k = nsDayKey(new Date(e.startDateTime));
      return k >= range[0] && k <= range[1];
    })
    .filter((e) => !q.search?.trim() || matchesSearch(e, q.search))
    .map((e) => ({
      ...e,
      distanceKm: q.origin ? distanceKm(q.origin, { lat: e.latitude, lng: e.longitude }) : undefined,
    }));

  if (q.origin && q.radiusKm) out = out.filter((e) => (e.distanceKm ?? Infinity) <= q.radiusKm!);

  const sort = q.sort === "CLOSEST" && !q.origin ? "SOONEST" : q.sort ?? "SOONEST";
  out.sort((a, b) => {
    if (sort === "CLOSEST") return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    if (sort === "ALPHA") return a.title.localeCompare(b.title);
    return Date.parse(a.startDateTime) - Date.parse(b.startDateTime);
  });
  return out;
}
