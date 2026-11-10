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

export function getAllEvents(): MusicEvent[] {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")).events as MusicEvent[];
}

export function getEventById(id: string): MusicEvent | undefined {
  return getAllEvents().find((e) => e.id === id);
}
