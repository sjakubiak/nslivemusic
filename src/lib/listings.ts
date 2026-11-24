/**
 * Regular nights (open mics, jams, sessions...) that people can add to or
 * correct. Anyone can send a suggestion; nothing goes live until the admin
 * approves it on /admin.
 *
 * The starting list is data/manual-events.json ("seed" entries). Edits and
 * new nights are stored as rows: in Cloudflare D1 when running on Cloudflare,
 * otherwise in data/listings.json for local development.
 *
 * No "server-only" import: the ingest pipeline (plain Node) reads this too.
 * Only server code may import it.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ManualEntry } from "../pipeline/sources/manual";
// Bundled rather than read from disk, so it also works on Cloudflare Workers.
import seedFile from "../../data/manual-events.json";

export type SuggestionKind = "new" | "edit" | "remove" | "report";
export type ListingStatus = "live" | "pending" | "rejected" | "applied" | "removed" | "done";

export interface Listing {
  id: string;
  kind: SuggestionKind;
  status: ListingStatus;
  /** For edit/remove: the listing the suggestion is about. */
  targetId?: string | null;
  /** For report: the event (from a calendar feed or Eventbrite) it's about. */
  eventId?: string | null;
  entry?: ManualEntry | null;
  /** What the person said about it. */
  note?: string | null;
  /** Optional email/phone, only shown on the admin page. */
  contact?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

const LOCAL_FILE = () => process.env.LISTINGS_FILE ?? path.join(process.cwd(), "data", "listings.json");

export function seedId(e: Pick<ManualEntry, "title" | "venue" | "city">): string {
  return `seed-${crypto.createHash("sha1").update([e.title, e.venue, e.city].join("|").toLowerCase()).digest("hex").slice(0, 12)}`;
}

export function loadSeeds(): Listing[] {
  try {
    const events = ((seedFile as { events?: unknown[] }).events ?? []) as ManualEntry[];
    return events.map((entry) => ({ id: seedId(entry), kind: "new", status: "live", entry, createdAt: entry.confirmedOn }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- backends

interface Backend {
  all(): Promise<Listing[]>;
  upsert(rows: Listing[]): Promise<void>;
}

const fileBackend: Backend = {
  async all() {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_FILE(), "utf8")) as Listing[];
    } catch {
      return [];
    }
  },
  async upsert(rows) {
    const byId = new Map((await this.all()).map((r) => [r.id, r]));
    for (const r of rows) byId.set(r.id, r);
    fs.mkdirSync(path.dirname(LOCAL_FILE()), { recursive: true });
    fs.writeFileSync(LOCAL_FILE(), JSON.stringify([...byId.values()], null, 2));
  },
};

/** Minimal shape of a Cloudflare D1 binding (only what we use). */
export interface D1Like {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }> }; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
  batch(stmts: unknown[]): Promise<unknown>;
}

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, target_id TEXT, event_id TEXT,
  entry TEXT, note TEXT, contact TEXT, created_at TEXT NOT NULL, reviewed_at TEXT)`;

/** Cloudflare D1 (free SQLite database bound to the Worker as `DB`). The table is created on first use. */
export function d1Backend(db: D1Like): Backend {
  let ready: Promise<unknown> | undefined;
  const init = () => (ready ??= db.prepare(CREATE_SQL).run());
  type Row = { id: string; kind: SuggestionKind; status: ListingStatus; target_id: string | null; event_id: string | null; entry: string | null; note: string | null; contact: string | null; created_at: string; reviewed_at: string | null };
  return {
    async all() {
      await init();
      const { results } = await db.prepare("SELECT * FROM listings ORDER BY created_at DESC").all<Row>();
      return results.map((r) => ({
        id: r.id, kind: r.kind, status: r.status, targetId: r.target_id, eventId: r.event_id,
        entry: r.entry ? (JSON.parse(r.entry) as ManualEntry) : null, note: r.note, contact: r.contact,
        createdAt: r.created_at, reviewedAt: r.reviewed_at,
      }));
    },
    async upsert(rows) {
      await init();
      const sql = `INSERT INTO listings (id, kind, status, target_id, event_id, entry, note, contact, created_at, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, status=excluded.status, target_id=excluded.target_id,
        event_id=excluded.event_id, entry=excluded.entry, note=excluded.note, contact=excluded.contact,
        created_at=excluded.created_at, reviewed_at=excluded.reviewed_at`;
      await db.batch(rows.map((l) => db.prepare(sql).bind(
        l.id, l.kind, l.status, l.targetId ?? null, l.eventId ?? null, l.entry ? JSON.stringify(l.entry) : null,
        l.note ?? null, l.contact ?? null, l.createdAt, l.reviewedAt ?? null,
      )));
    },
  };
}

/** The Worker's D1 binding, when running on Cloudflare. Undefined in plain Node (local dev, tests, ingest). */
export async function d1(): Promise<D1Like | undefined> {
  if (!(typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")) return undefined;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return (getCloudflareContext().env as { DB?: D1Like }).DB;
  } catch {
    return undefined;
  }
}

/**
 * Ingest runs in GitHub Actions, away from the database. It reads the live
 * nights from the site itself (LISTINGS_URL, a public list of approved nights only).
 */
function remoteBackend(url: string): Backend {
  return {
    async all() {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return ((await res.json()) as { listings: Listing[] }).listings;
      } catch (err) {
        // First deploy, or the site is down: fall back to the starter list.
        console.warn(`[listings] couldn't read ${url}: ${(err as Error).message}; using the starter list only`);
        return [];
      }
    },
    async upsert() {
      throw new Error("read-only");
    },
  };
}

async function backend(): Promise<Backend> {
  const db = await d1();
  if (db) return d1Backend(db);
  if (process.env.LISTINGS_URL) return remoteBackend(process.env.LISTINGS_URL);
  return fileBackend;
}

export function storageIsPermanent(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

// ---------------------------------------------------------------- queries

/** Seeds overlaid with stored rows (a stored row with a seed's id replaces it). */
export async function allListings(): Promise<Listing[]> {
  const stored = await (await backend()).all();
  const ids = new Set(stored.map((r) => r.id));
  return [...loadSeeds().filter((s) => !ids.has(s.id)), ...stored];
}

export async function liveListings(): Promise<Listing[]> {
  return (await allListings()).filter((l) => l.status === "live" && l.entry);
}

export async function getListing(id: string): Promise<Listing | undefined> {
  return (await allListings()).find((l) => l.id === id);
}

export async function pendingSuggestions(): Promise<Listing[]> {
  return (await allListings()).filter((l) => l.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------- changes

export async function submitSuggestion(s: Pick<Listing, "kind" | "targetId" | "eventId" | "entry" | "note" | "contact">, now = new Date()): Promise<Listing> {
  const row: Listing = { ...s, id: `sug-${crypto.randomUUID()}`, status: "pending", createdAt: now.toISOString() };
  await (await backend()).upsert([row]);
  return row;
}

/** Approve a suggestion: a new night goes live, an edit replaces its target, a removal takes the target down. */
export async function approve(id: string, edited?: ManualEntry, now = new Date()): Promise<void> {
  const s = await getListing(id);
  if (!s || s.status !== "pending") throw new Error("That suggestion isn't waiting for review any more.");
  const reviewedAt = now.toISOString();
  const entry = edited ?? s.entry ?? undefined;
  if (s.kind === "new") {
    if (!entry) throw new Error("This suggestion has no event details.");
    await (await backend()).upsert([{ ...s, entry, status: "live", reviewedAt }]);
    return;
  }
  if (s.kind === "report") {
    await (await backend()).upsert([{ ...s, status: "done", reviewedAt }]);
    return;
  }
  const target = s.targetId ? await getListing(s.targetId) : undefined;
  if (!target) throw new Error("The night this suggestion is about no longer exists.");
  const updated: Listing =
    s.kind === "remove"
      ? { ...target, status: "removed", reviewedAt }
      : { ...target, entry: { ...entry!, confirmedOn: nsToday(now) }, status: "live", reviewedAt };
  await (await backend()).upsert([updated, { ...s, entry, status: "applied", reviewedAt }]);
}

export async function reject(id: string, now = new Date()): Promise<void> {
  const s = await getListing(id);
  if (!s || s.status !== "pending") throw new Error("That suggestion isn't waiting for review any more.");
  await (await backend()).upsert([{ ...s, status: "rejected", reviewedAt: now.toISOString() }]);
}

/** Admin's own direct changes (no suggestion step). */
export async function saveListing(id: string | undefined, entry: ManualEntry, now = new Date()): Promise<string> {
  const existing = id ? await getListing(id) : undefined;
  const row: Listing = existing
    ? { ...existing, entry, status: "live", reviewedAt: now.toISOString() }
    : { id: `lst-${crypto.randomUUID()}`, kind: "new", status: "live", entry, createdAt: now.toISOString(), reviewedAt: now.toISOString() };
  await (await backend()).upsert([row]);
  return row.id;
}

export async function removeListing(id: string, now = new Date()): Promise<void> {
  const existing = await getListing(id);
  if (!existing) throw new Error("Not found.");
  await (await backend()).upsert([{ ...existing, status: "removed", reviewedAt: now.toISOString() }]);
}

function nsToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax" }).format(now);
}
