/**
 * Auto-finder: crawls listing pages and venue websites for machine-readable
 * event sources (iCal feeds, Google Calendars, WordPress event calendars,
 * schema.org JSON-LD) and Eventbrite organizers, then records them in
 * data/discovered.json for the ingest pipeline to use.
 *
 *   npm run discover
 *
 * Polite by construction: everything goes through politeFetch (robots.txt,
 * identifying User-Agent, 5 s per host), pages per site are capped, and we
 * never crawl social media or ticketing sites, only read IDs from their links.
 */
import fs from "node:fs";
import path from "node:path";
import { politeFetch } from "../pipeline/polite-fetch";
import { isBlocked } from "../pipeline/blocklist";
import { detectSources } from "./detect";
import { LISTING_PAGES, VENUE_SITES } from "./seeds";
import { type Found, discoveredPath, loadDiscovered, mergeFound } from "./store";

const MAX_PAGES = Number(process.env.DISCOVER_MAX_PAGES ?? 250);
const MAX_PAGES_PER_HOST = 6;

interface Item {
  url: string;
  /** listing: follow external links (venue sites). venue: follow event-ish same-site links. */
  role: "listing" | "venue" | "venue-subpage";
  via: string;
}

async function resolveEventbriteOrganizers(eventIds: Map<string, string>): Promise<Omit<Found, "firstSeen" | "lastSeen">[]> {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token || !eventIds.size) return [];
  const out: Omit<Found, "firstSeen" | "lastSeen">[] = [];
  for (const [id, foundOn] of eventIds) {
    try {
      const res = await fetch(`https://www.eventbriteapi.com/v3/events/${id}/?expand=venue,organizer`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) continue;
      const e = (await res.json()) as { organizer_id?: string; organizer?: { name?: string }; venue?: { address?: { region?: string } } };
      const region = e.venue?.address?.region ?? "";
      if (e.organizer_id && /^(ns|nova scotia)$/i.test(region.trim())) out.push({ key: e.organizer_id, foundOn, label: e.organizer?.name });
    } catch {
      // network hiccup: try again tomorrow
    }
  }
  return out;
}

async function main() {
  const now = new Date();
  const queues = new Map<string, Item[]>();
  const seen = new Set<string>();
  const perHost = new Map<string, number>();
  const enqueue = (it: Item) => {
    if (isBlocked(it.url)) return;
    const u = new URL(it.url);
    const key = `${u.origin}${u.pathname}`;
    if (seen.has(key)) return;
    seen.add(key);
    const q = queues.get(u.host) ?? [];
    q.push(it);
    queues.set(u.host, q);
  };
  LISTING_PAGES.forEach((url) => enqueue({ url, role: "listing", via: "seed" }));
  VENUE_SITES.forEach((url) => enqueue({ url, role: "venue", via: "seed" }));

  const feeds: Omit<Found, "firstSeen" | "lastSeen">[] = [];
  const jsonLd: Omit<Found, "firstSeen" | "lastSeen">[] = [];
  const orgs: Omit<Found, "firstSeen" | "lastSeen">[] = [];
  const ebEvents = new Map<string, string>();
  let pages = 0;
  let failures = 0;

  // Round-robin across hosts so the per-host delay rarely makes us wait.
  while (pages < MAX_PAGES && queues.size) {
    for (const [host, q] of [...queues]) {
      const it = q.shift();
      if (!q.length) queues.delete(host);
      if (!it || pages >= MAX_PAGES) continue;
      const n = perHost.get(host) ?? 0;
      if (n >= MAX_PAGES_PER_HOST) continue;
      perHost.set(host, n + 1);
      pages++;
      let html: string;
      try {
        html = await politeFetch(it.url);
      } catch (err) {
        failures++;
        console.warn(`[discover] ${it.url}: ${(err as Error).message}`);
        continue;
      }
      const d = detectSources(html, it.url);
      d.icalUrls.forEach((key) => feeds.push({ key, foundOn: it.url }));
      if (d.hasJsonLdEvents) jsonLd.push({ key: it.url, foundOn: it.via === "seed" ? it.url : it.via });
      d.eventbriteOrganizerIds.forEach((key) => orgs.push({ key, foundOn: it.url }));
      d.eventbriteEventIds.forEach((id) => ebEvents.has(id) || ebEvents.set(id, it.url));
      if (it.role === "listing") d.externalLinks.forEach((url) => enqueue({ url, role: "venue", via: it.url }));
      if (it.role === "venue") d.eventPageLinks.slice(0, MAX_PAGES_PER_HOST).forEach((url) => enqueue({ url, role: "venue-subpage", via: it.url }));
    }
  }

  orgs.push(...(await resolveEventbriteOrganizers(ebEvents)));

  const prev = loadDiscovered();
  const next = {
    updatedAt: now.toISOString(),
    feeds: mergeFound(prev.feeds, dedupeKeys(feeds), now),
    jsonLdPages: mergeFound(prev.jsonLdPages, dedupeKeys(jsonLd), now),
    eventbriteOrganizers: mergeFound(prev.eventbriteOrganizers, dedupeKeys(orgs), now),
  };
  // Only rewrite the file when the set of sources changed, or weekly to refresh lastSeen,
  // so the daily job doesn't commit (and redeploy) for nothing.
  const keys = (d: typeof prev) => JSON.stringify([d.feeds, d.jsonLdPages, d.eventbriteOrganizers].map((l) => l.map((f) => f.key)));
  const weekOld = !prev.updatedAt || now.getTime() - Date.parse(prev.updatedAt) > 7 * 86_400_000;
  if (keys(prev) !== keys(next) || weekOld) {
    fs.mkdirSync(path.dirname(discoveredPath()), { recursive: true });
    fs.writeFileSync(discoveredPath(), `${JSON.stringify(next, null, 2)}\n`);
  } else {
    console.log("[discover] no new or removed sources");
  }
  console.log(
    `[discover] pages=${pages} failed=${failures} feeds=${next.feeds.length} jsonLdPages=${next.jsonLdPages.length} ` +
      `eventbriteOrganizers=${next.eventbriteOrganizers.length} (eventbrite event links seen: ${ebEvents.size})`,
  );
}

function dedupeKeys<T extends { key: string }>(xs: T[]): T[] {
  return [...new Map(xs.map((x) => [x.key, x])).values()];
}

main();
