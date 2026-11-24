/**
 * Visitor feedback from /feedback. Stored in Cloudflare D1 (table "feedback")
 * when running on Cloudflare, otherwise in data/feedback.json for local
 * development. Only the admin sees it, on /admin.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { d1, type D1Like } from "./listings";

export const TOPICS = [
  ["idea", "An idea or request"],
  ["missing", "A venue or event that's missing"],
  ["problem", "Something isn't working"],
  ["thanks", "Just saying thanks"],
  ["other", "Something else"],
] as const;

export const FOUND_VIA = [
  ["search", "Google or another search"],
  ["friend", "A friend told me"],
  ["social", "Facebook, Instagram or Reddit"],
  ["venue", "A venue or musician"],
  ["other", "Somewhere else"],
] as const;

export type Topic = (typeof TOPICS)[number][0];
export type FoundVia = (typeof FOUND_VIA)[number][0];
export type FeedbackStatus = "new" | "read";

export interface Feedback {
  id: string;
  topic: Topic;
  message: string;
  foundVia?: FoundVia | null;
  town?: string | null;
  /** Email, only if they gave one. */
  contact?: string | null;
  /** They ticked "you can email me about the site". */
  mayContact: boolean;
  /** The page they were on when they clicked "Feedback". */
  page?: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

interface Store {
  all(): Promise<Feedback[]>;
  upsert(row: Feedback): Promise<void>;
  remove(id: string): Promise<void>;
}

const LOCAL_FILE = () => process.env.FEEDBACK_FILE ?? path.join(process.cwd(), "data", "feedback.json");

const fileStore: Store = {
  async all() {
    try {
      const rows = JSON.parse(fs.readFileSync(LOCAL_FILE(), "utf8")) as Feedback[];
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  },
  async upsert(row) {
    const rows = (await this.all()).filter((r) => r.id !== row.id);
    fs.mkdirSync(path.dirname(LOCAL_FILE()), { recursive: true });
    fs.writeFileSync(LOCAL_FILE(), JSON.stringify([row, ...rows], null, 2));
  },
  async remove(id) {
    const rows = (await this.all()).filter((r) => r.id !== id);
    fs.writeFileSync(LOCAL_FILE(), JSON.stringify(rows, null, 2));
  },
};

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY, topic TEXT NOT NULL, message TEXT NOT NULL, found_via TEXT, town TEXT,
  contact TEXT, may_contact INTEGER NOT NULL DEFAULT 0, page TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL)`;

/** The table is created on first use, like the listings table. */
export function d1FeedbackStore(db: D1Like): Store {
  let ready: Promise<unknown> | undefined;
  const init = () => (ready ??= db.prepare(CREATE_SQL).run());
  type Row = { id: string; topic: Topic; message: string; found_via: FoundVia | null; town: string | null; contact: string | null; may_contact: number; page: string | null; status: FeedbackStatus; created_at: string };
  return {
    async all() {
      await init();
      const { results } = await db.prepare("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 500").all<Row>();
      return results.map((r) => ({
        id: r.id, topic: r.topic, message: r.message, foundVia: r.found_via, town: r.town, contact: r.contact,
        mayContact: Boolean(r.may_contact), page: r.page, status: r.status, createdAt: r.created_at,
      }));
    },
    async upsert(f) {
      await init();
      await db.prepare(
        `INSERT INTO feedback (id, topic, message, found_via, town, contact, may_contact, page, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
      ).bind(f.id, f.topic, f.message, f.foundVia ?? null, f.town ?? null, f.contact ?? null, f.mayContact ? 1 : 0, f.page ?? null, f.status, f.createdAt).run();
    },
    async remove(id) {
      await init();
      await db.prepare("DELETE FROM feedback WHERE id = ?").bind(id).run();
    },
  };
}

async function store(): Promise<Store> {
  const db = await d1();
  return db ? d1FeedbackStore(db) : fileStore;
}

export async function allFeedback(): Promise<Feedback[]> {
  return (await store()).all();
}

export async function saveFeedback(f: Omit<Feedback, "id" | "status" | "createdAt">, now = new Date()): Promise<Feedback> {
  const row: Feedback = { ...f, id: `fb-${crypto.randomUUID()}`, status: "new", createdAt: now.toISOString() };
  await (await store()).upsert(row);
  return row;
}

export async function markFeedbackRead(id: string): Promise<void> {
  const f = (await allFeedback()).find((r) => r.id === id);
  if (!f) throw new Error("That feedback isn't there any more.");
  await (await store()).upsert({ ...f, status: "read" });
}

export async function deleteFeedback(id: string): Promise<void> {
  await (await store()).remove(id);
}

// ---------------------------------------------------------------- form

export class FeedbackError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks and tidies the public form. Everything here is user input. */
export function feedbackFromForm(get: (key: string) => string): Omit<Feedback, "id" | "status" | "createdAt"> {
  const clean = (v: string, max: number) => v.trim().slice(0, max);
  const message = get("message").trim().replace(/\r\n/g, "\n");
  if (!message) throw new FeedbackError("Please write a message.");
  if (message.length > 2000) throw new FeedbackError("That message is too long (max 2000 characters).");
  const topic = (TOPICS.some(([k]) => k === get("topic")) ? get("topic") : "other") as Topic;
  const foundVia = FOUND_VIA.some(([k]) => k === get("foundVia")) ? (get("foundVia") as FoundVia) : null;
  const contact = clean(get("contact"), 120) || null;
  if (contact && !EMAIL.test(contact)) throw new FeedbackError("That email address doesn't look right.");
  const mayContact = Boolean(contact) && get("mayContact") === "on";
  // Only keep a path on this site, never a full outside address.
  const rawPage = clean(get("page"), 200);
  const page = rawPage.startsWith("/") && !rawPage.startsWith("//") ? rawPage : null;
  return { topic, message, foundVia, town: clean(get("town").replace(/\s+/g, " "), 80) || null, contact, mayContact, page };
}
