import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { MusicEvent } from "./types";

/**
 * The "database" for v1 is the JSON file the ingestion pipeline writes
 * (`npm run ingest`). Swap this module for Postgres/PostGIS later; nothing
 * else in the app reads the file directly.
 */
const DB_PATH = path.join(process.cwd(), "data", "events.json");

interface Store {
  generatedAt?: string;
  /** True when fictional sample events are included (no real source on yet). */
  sampleData?: boolean;
  events: MusicEvent[];
}

function read(): Store {
  if (!fs.existsSync(DB_PATH)) return { events: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Store;
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
