import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { d1Backend } from "./listings";

/** A tiny stand-in for a Cloudflare D1 binding, backed by in-memory SQLite. */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    run: async () => db.prepare(sql).run(...(args as never[])),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
  });
  return { prepare: (sql: string) => stmt(sql), batch: async (s: { run(): Promise<unknown> }[]) => { for (const x of s) await x.run(); } };
}

describe("D1 storage", () => {
  it("creates the table, inserts and updates rows", async () => {
    const b = d1Backend(fakeD1() as never);
    expect(await b.all()).toEqual([]);
    const entry = { title: "Open Mic", venue: "Pub", city: "Halifax", weekly: ["TU"], start: "21:00", source: "test", confirmedOn: "2026-11-23" };
    await b.upsert([{ id: "a", kind: "new", status: "pending", entry, note: "hi", contact: null, createdAt: "2026-11-23T10:00:00Z" }]);
    await b.upsert([{ id: "a", kind: "new", status: "live", entry, note: "hi", contact: null, createdAt: "2026-11-23T10:00:00Z", reviewedAt: "2026-11-23T11:00:00Z" }]);
    const rows = await b.all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a", status: "live", entry: { title: "Open Mic", weekly: ["TU"] }, reviewedAt: "2026-11-23T11:00:00Z" });
  });
});
