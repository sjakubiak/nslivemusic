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
import { icalSource } from "./sources/ical";
import { wpTribeSource } from "./sources/wp-tribe";
import { facebookPagesSource } from "./sources/facebook-pages";
import { manualSource } from "./sources/manual";
import { geocodeMissing } from "./geocode";
import type { RawEvent } from "./types";

export const REAL_SOURCES: Source[] = [manualSource, icalSource, wpTribeSource, jsonLdVenueSource, eventbriteSource, facebookPagesSource];
const SAMPLE_SOURCES: Source[] = [sampleVenueSource, sampleListingSource];

/**
 * SAMPLE_DATA=auto (default): fictional sample events only while no real
 * source is switched on. "on" mixes them in anyway; "off" never shows them.
 * DISABLE_SAMPLE_DATA=1 is still honoured as "off".
 */
function sampleMode(): "auto" | "on" | "off" {
  if (process.env.DISABLE_SAMPLE_DATA) return "off";
  const m = (process.env.SAMPLE_DATA ?? "auto").toLowerCase();
  return m === "on" || m === "off" ? m : "auto";
}

async function main() {
  const now = new Date();
  const normalised: MusicEvent[] = [];
  const rejected: string[] = [];
  const perSource: Record<string, number> = {};
  const raws: RawEvent[] = [];

  const real = REAL_SOURCES.filter((s) => s.enabled());
  const mode = sampleMode();
  console.log(`[ingest] real sources on: ${real.map((s) => s.id).join(", ") || "none"}`);

  const collect = async (sources: Source[]) => {
    for (const src of sources) {
      try {
        const raw = await src.fetch();
        perSource[src.id] = raw.length;
        raws.push(...raw);
      } catch (err) {
        console.warn(`[${src.id}] failed: ${(err as Error).message}`);
      }
    }
  };
  await collect(real);
  // In auto mode, an empty result (nothing on yet, or every feed down) falls back to samples
  // rather than showing an empty map.
  const useSample = mode === "on" || (mode === "auto" && raws.length === 0);
  if (useSample) await collect(SAMPLE_SOURCES);
  console.log(`[ingest] sample data ${useSample ? "on" : "off"}`);

  if (raws.some((r) => !r.sourceId.startsWith("sample"))) {
    const filled = await geocodeMissing(raws);
    if (filled) console.log(`[ingest] geocoded ${filled} events`);
  }

  for (const r of raws) {
    const { event, reason } = normaliseEvent(r, now);
    if (event) normalised.push(event);
    else rejected.push(`${r.sourceId}: ${reason}`);
  }

  const { events, merged } = dedupe(normalised);
  const out = path.join(process.cwd(), "data", "events.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(
      { generatedAt: now.toISOString(), sampleData: useSample, sources: Object.keys(perSource), events },
      null,
      2,
    ));

  console.log(
    `[ingest] sources=${JSON.stringify(perSource)} normalised=${normalised.length} ` +
      `rejected=${rejected.length} duplicatesMerged=${merged} stored=${events.length}`,
  );
  for (const r of rejected.slice(0, 10)) console.log(`  rejected: ${r}`);
}

main();
