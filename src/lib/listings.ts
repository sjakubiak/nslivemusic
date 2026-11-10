/**
 * Regular nights (open mics, jams, sessions...) that people can add to or
 * correct. Anyone can send a suggestion; nothing goes live until the admin
 * approves it on /admin.
 *
 * The starting list is data/manual-events.json ("seed" entries). Edits and
 * new nights are stored as rows: in Supabase when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set (Render's disk is wiped on every deploy),
 * otherwise in data/listings.json for local development.
 *
 * No "server-only" import: the ingest pipeline (plain Node) reads this too.
 * Only server code may import it, because it uses the service key.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ManualEntry } from "../pipeline/sources/manual";

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

const SEED_FILE = () => path.join(process.cwd(), "data", "manual-events.json");
const LOCAL_FILE = () => process.env.LISTINGS_FILE ?? path.join(process.cwd(), "data", "listings.json");

export function seedId(e: Pick<ManualEntry, "title" | "venue" | "city">): string {
  return `seed-${crypto.createHash("sha1").update([e.title, e.venue, e.city].join("|").toLowerCase()).digest("hex").slice(0, 12)}`;
}

export function loadSeeds(): Listing[] {
  try {
    const events = (JSON.parse(fs.readFileSync(SEED_FILE(), "utf8")).events ?? []) as ManualEntry[];
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

/** Supabase over its REST API: table `listings` (see docs/supabase-listings.sql). */
function supabaseBackend(url: string, key: string): Backend {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`; // legacy JWT service_role key
  const toRow = (l: Listing) => ({
    id: l.id, kind: l.kind, status: l.status, target_id: l.targetId ?? null, event_id: l.eventId ?? null,
    entry: l.entry ?? null, note: l.note ?? null, contact: l.contact ?? null, created_at: l.createdAt, reviewed_at: l.reviewedAt ?? null,
  });
  type Row = ReturnType<typeof toRow>;
  const fromRow = (r: Row): Listing => ({
    id: r.id, kind: r.kind, status: r.status, targetId: r.target_id, eventId: r.event_id,
    entry: r.entry, note: r.note, contact: r.contact, createdAt: r.created_at, reviewedAt: r.reviewed_at,
  });
  const base = `${url.replace(/\/$/, "")}/rest/v1/listings`;
  return {
    async all() {
      const res = await fetch(`${base}?select=*&order=created_at.desc`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`listings read failed: ${res.status} ${await res.text()}`);
      return ((await res.json()) as Row[]).map(fromRow);
    },
    async upsert(rows) {
      const res = await fetch(base, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows.map(toRow)),
      });
      if (!res.ok) throw new Error(`listings write failed: ${res.status} ${await res.text()}`);
    },
  };
}

function backend(): Backend {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? supabaseBackend(url, key) : fileBackend;
}

export function storageIsPermanent(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------- queries

/** Seeds overlaid with stored rows (a stored row with a seed's id replaces it). */
export async function allListings(): Promise<Listing[]> {
  const stored = await backend().all();
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
  await backend().upsert([row]);
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
    await backend().upsert([{ ...s, entry, status: "live", reviewedAt }]);
    return;
  }
  if (s.kind === "report") {
    await backend().upsert([{ ...s, status: "done", reviewedAt }]);
    return;
  }
  const target = s.targetId ? await getListing(s.targetId) : undefined;
  if (!target) throw new Error("The night this suggestion is about no longer exists.");
  const updated: Listing =
    s.kind === "remove"
      ? { ...target, status: "removed", reviewedAt }
      : { ...target, entry: { ...entry!, confirmedOn: nsToday(now) }, status: "live", reviewedAt };
  await backend().upsert([updated, { ...s, entry, status: "applied", reviewedAt }]);
}

export async function reject(id: string, now = new Date()): Promise<void> {
  const s = await getListing(id);
  if (!s || s.status !== "pending") throw new Error("That suggestion isn't waiting for review any more.");
  await backend().upsert([{ ...s, status: "rejected", reviewedAt: now.toISOString() }]);
}

/** Admin's own direct changes (no suggestion step). */
export async function saveListing(id: string | undefined, entry: ManualEntry, now = new Date()): Promise<string> {
  const existing = id ? await getListing(id) : undefined;
  const row: Listing = existing
    ? { ...existing, entry, status: "live", reviewedAt: now.toISOString() }
    : { id: `lst-${crypto.randomUUID()}`, kind: "new", status: "live", entry, createdAt: now.toISOString(), reviewedAt: now.toISOString() };
  await backend().upsert([row]);
  return row.id;
}

export async function removeListing(id: string, now = new Date()): Promise<void> {
  const existing = await getListing(id);
  if (!existing) throw new Error("Not found.");
  await backend().upsert([{ ...existing, status: "removed", reviewedAt: now.toISOString() }]);
}

function nsToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax" }).format(now);
}
