import fs from "node:fs";
import path from "node:path";

/**
 * What the auto-finder has discovered. Committed to the repo by the daily
 * GitHub Action, so it survives Render restarts and every change is reviewable
 * in git history. The ingest pipeline reads it (feeds.ts, jsonld-venue.ts,
 * eventbrite.ts).
 */
export interface Found {
  /** Feed URL, page URL, or Eventbrite organizer ID. */
  key: string;
  /** Page where we found it. */
  foundOn: string;
  firstSeen: string;
  lastSeen: string;
  /** Free-form label: venue/organizer name when known. */
  label?: string;
}

export interface Discovered {
  updatedAt: string;
  feeds: Found[];
  jsonLdPages: Found[];
  eventbriteOrganizers: Found[];
}

/** Entries not seen again for this long are dropped. */
export const STALE_DAYS = 60;

export const discoveredPath = () => process.env.DISCOVERED_PATH ?? path.join(process.cwd(), "data", "discovered.json");

export function loadDiscovered(): Discovered {
  try {
    return JSON.parse(fs.readFileSync(discoveredPath(), "utf8")) as Discovered;
  } catch {
    return { updatedAt: "", feeds: [], jsonLdPages: [], eventbriteOrganizers: [] };
  }
}

/** Merge this run's finds into the stored list: keep firstSeen, bump lastSeen, prune stale. */
export function mergeFound(prev: Found[], found: Omit<Found, "firstSeen" | "lastSeen">[], now: Date): Found[] {
  const today = now.toISOString().slice(0, 10);
  const byKey = new Map(prev.map((f) => [f.key, f]));
  for (const f of found) {
    const old = byKey.get(f.key);
    byKey.set(f.key, { ...f, label: f.label ?? old?.label, firstSeen: old?.firstSeen ?? today, lastSeen: today });
  }
  const cutoff = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString().slice(0, 10);
  return [...byKey.values()].filter((f) => f.lastSeen >= cutoff).sort((a, b) => a.key.localeCompare(b.key));
}
