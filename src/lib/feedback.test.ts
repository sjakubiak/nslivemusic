import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { d1FeedbackStore, FeedbackError, feedbackFromForm } from "./feedback";

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    run: async () => db.prepare(sql).run(...(args as never[])),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
  });
  return { prepare: (sql: string) => stmt(sql), batch: async () => {} };
}

const form = (v: Record<string, string>) => (k: string) => v[k] ?? "";

describe("feedback form", () => {
  it("keeps what's given and tidies it", () => {
    const f = feedbackFromForm(form({ topic: "idea", message: " More Wolfville please ", foundVia: "friend", town: " Wolfville ", contact: "a@b.ca", mayContact: "on", page: "/live-music/halifax" }));
    expect(f).toEqual({ topic: "idea", message: "More Wolfville please", foundVia: "friend", town: "Wolfville", contact: "a@b.ca", mayContact: true, page: "/live-music/halifax" });
  });
  it("needs a message and a valid email", () => {
    expect(() => feedbackFromForm(form({ message: "  " }))).toThrow(FeedbackError);
    expect(() => feedbackFromForm(form({ message: "hi", contact: "not an email" }))).toThrow(FeedbackError);
  });
  it("ignores unknown choices, outside pages, and consent without an email", () => {
    const f = feedbackFromForm(form({ topic: "hack", message: "hi", foundVia: "x", mayContact: "on", page: "https://example.com/" }));
    expect(f).toMatchObject({ topic: "other", foundVia: null, mayContact: false, page: null, contact: null });
    expect(feedbackFromForm(form({ message: "hi", page: "//evil.example" })).page).toBeNull();
  });
});

describe("feedback storage (D1)", () => {
  it("saves, marks read and deletes", async () => {
    const s = d1FeedbackStore(fakeD1() as never);
    expect(await s.all()).toEqual([]);
    const row = { id: "fb-1", topic: "idea" as const, message: "hi", foundVia: null, town: null, contact: "a@b.ca", mayContact: true, page: null, status: "new" as const, createdAt: "2026-11-24T10:00:00Z" };
    await s.upsert(row);
    await s.upsert({ ...row, status: "read" });
    expect(await s.all()).toEqual([{ ...row, status: "read" }]);
    await s.remove("fb-1");
    expect(await s.all()).toEqual([]);
  });
});
