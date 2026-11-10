import fs from "node:fs";
import path from "node:path";
import type { RawEvent } from "./types";
import { findVenue } from "./venues";

/**
 * Fill in coordinates for events whose source and venue registry don't have
 * them, using OpenStreetMap Nominatim. Follows the Nominatim usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/): identifying
 * User-Agent, max 1 request/second, results cached on disk, small volumes.
 * Set SCRAPER_USER_AGENT to something with a contact URL or email.
 * Misses are cached too so we don't ask again every run.
 */
const cachePath = () => process.env.GEOCODE_CACHE ?? path.join(process.cwd(), "data", "geocode-cache.json");
const MAX_LOOKUPS_PER_RUN = 60;
const USER_AGENT = process.env.SCRAPER_USER_AGENT ?? "NSLiveMusicFinderBot/1.0 (+https://nslivemusic.onrender.com)";

type Cache = Record<string, { lat: number; lng: number } | null>;

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), "utf8"));
  } catch {
    return {};
  }
}

export function geocodeQuery(r: Pick<RawEvent, "venueName" | "address" | "city">): string | null {
  const v = findVenue(r.venueName, r.city);
  const address = r.address ?? v?.address;
  const city = r.city ?? v?.city;
  if (!city) return null;
  // Street addresses geocode reliably; otherwise try the venue name in its town.
  const street = address?.split(",")[0].trim();
  return `${street || r.venueName}, ${city}, Nova Scotia, Canada`;
}

/** Rural addresses ("148 Main Street, Port Hood") are often missing from OpenStreetMap. */
export function townQuery(r: Pick<RawEvent, "venueName" | "address" | "city">): string | null {
  const city = r.city ?? findVenue(r.venueName, r.city)?.city;
  if (!city) return null;
  return `${city}, Nova Scotia, Canada`;
}

export async function geocodeMissing(raws: RawEvent[], lookup: (q: string) => Promise<{ lat: number; lng: number } | null> = nominatim): Promise<number> {
  const cache = loadCache();
  let lookups = 0;
  let filled = 0;
  for (const r of raws) {
    if (r.latitude != null && r.longitude != null) continue;
    const v = findVenue(r.venueName, r.city);
    if (v?.latitude != null) continue; // registry already places it
    const q = geocodeQuery(r);
    if (!q) continue;
    // A small-town hall or pub that OpenStreetMap doesn't know still belongs
    // on the map: fall back to the middle of its town.
    const town = townQuery(r);
    let hit: { lat: number; lng: number } | null | undefined;
    for (const query of town && town !== q ? [q, town] : [q]) {
      if (!(query in cache)) {
        if (lookups >= MAX_LOOKUPS_PER_RUN) break;
        lookups++;
        try {
          cache[query] = await lookup(query);
        } catch (err) {
          console.warn(`[geocode] ${query}: ${(err as Error).message}`);
          break; // don't cache transient errors
        }
      }
      hit = cache[query];
      if (hit) break;
    }
    if (hit) {
      r.latitude = hit.lat;
      r.longitude = hit.lng;
      filled++;
    }
  }
  if (lookups) {
    fs.mkdirSync(path.dirname(cachePath()), { recursive: true });
    fs.writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
  }
  return filled;
}

let last = 0;
async function nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const qs = new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "ca" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  // Nova Scotia bounding box: guards against a same-named street elsewhere.
  if (lat < 43.3 || lat > 47.1 || lng < -66.5 || lng > -59.6) return null;
  return { lat, lng };
}
