import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { MusicEvent } from "./types";
// Written by `npm run ingest`, which runs before every build, so the file is
// always there when the app is bundled. (It isn't committed, hence ts-ignore.)
// @ts-ignore
import bundled from "../../data/events.json";

/**
 * The "database" is the JSON file the ingestion pipeline writes. On a Node
 * server (local dev, Render) the file is re-read on each request, so the
 * in-process 6-hourly refresh shows up without a restart. On Cloudflare there
 * is no disk: the copy bundled at build time is used, and the site is rebuilt
 * every 6 hours by the GitHub "Deploy to Cloudflare" workflow.
 */
const DB_PATH = path.join(process.cwd(), "data", "events.json");

interface Store {
  generatedAt?: string;
  /** True when fictional sample events are included (no real source on yet). */
  sampleData?: boolean;
  events: MusicEvent[];
}

function read(): Store {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Store;
  } catch {
    // No filesystem (Cloudflare Workers): fall through to the bundled copy.
  }
  return (bundled as Store) ?? { events: [] };
}

export function getAllEvents(): MusicEvent[] {
  return read().events;
}

export function isSampleData(): boolean {
  return read().sampleData ?? true;
}

export function getEventById(id: string): MusicEvent | undefined {
  return getAllEvents().find((e) => e.id === id);
}
