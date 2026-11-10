/**
 * Ingestion pipeline: Scrapers → Normalisation → Deduplication → Database.
 * Run with `npm run ingest` (also runs before `dev` and `build`). Schedule it
 * with cron / a hosted scheduler, e.g. every 6 hours.
 */
import fs from "node:fs";
import path from "node:path";
import type { MusicEvent } from "../lib/types";
import type { Source } from "./types";
import { normaliseEvent } from "./normalize";
import { dedupe } from "./dedupe";
import { sampleVenueSource } from "./sources/sample-venues";
import { sampleListingSource } from "./sources/sample-listing";
import { jsonLdVenueSource } from "./sources/jsonld-venue";
import { eventbriteSource } from "./sources/eventbrite";

export const SOURCES: Source[] = [
  ...(process.env.DISABLE_SAMPLE_DATA ? [] : [sampleVenueSource, sampleListingSource]),
  jsonLdVenueSource,
  eventbriteSource,
];

async function main() {
  const now = new Date();
  const normalised: MusicEvent[] = [];
  const rejected: string[] = [];
  const perSource: Record<string, number> = {};

  for (const src of SOURCES.filter((s) => s.enabled())) {
    try {
      const raw = await src.fetch();
      perSource[src.id] = raw.length;
      for (const r of raw) {
        const { event, reason } = normaliseEvent(r, now);
        if (event) normalised.push(event);
        else rejected.push(`${src.id}: ${reason}`);
      }
    } catch (err) {
      console.warn(`[${src.id}] failed: ${(err as Error).message}`);
    }
  }

  const { events, merged } = dedupe(normalised);
  const out = path.join(process.cwd(), "data", "events.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ generatedAt: now.toISOString(), events }, null, 2));

  console.log(
    `[ingest] sources=${JSON.stringify(perSource)} normalised=${normalised.length} ` +
      `rejected=${rejected.length} duplicatesMerged=${merged} stored=${events.length}`,
  );
  for (const r of rejected.slice(0, 10)) console.log(`  rejected: ${r}`);
}

main();
