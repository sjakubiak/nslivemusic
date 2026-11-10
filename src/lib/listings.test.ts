import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { allListings, approve, liveListings, loadSeeds, pendingSuggestions, reject, removeListing, saveListing, submitSuggestion } from "./listings";
import { entryFromForm, FormError } from "./listing-form";

const form = (o: Record<string, string | string[]>) => o;
const base = { title: "Open Mic", venue: "Test Pub", city: "Halifax", weekly: ["TU"], start: "21:00" };

beforeEach(() => {
  process.env.LISTINGS_FILE = path.join(os.tmpdir(), `listings-${Date.now()}-${Math.random()}.json`);
  delete process.env.SUPABASE_URL;
});

describe("suggestion form", () => {
  it("builds an entry and rejects bad input", () => {
    const e = entryFromForm(form({ ...base, end: "23:30", cover: "Free", website: "example.ca/open-mic" }), "test", "2026-11-10");
    expect(e).toMatchObject({ title: "Open Mic", weekly: ["TU"], start: "21:00", end: "23:30", website: "https://example.ca/open-mic", confirmedOn: "2026-11-10" });
    expect(() => entryFromForm(form({ ...base, weekly: [] }), "t", "2026-11-10")).toThrow(FormError);
    expect(() => entryFromForm(form({ ...base, start: "late" }), "t", "2026-11-10")).toThrow(FormError);
    expect(() => entryFromForm(form({ ...base, website: "javascript:alert(1)" }), "t", "2026-11-10")).toThrow(FormError);
    expect(() => entryFromForm(form({ ...base, website: "https://livemusichalifax.ca/x" }), "t", "2026-11-10")).toThrow(/aren't allowed/);
    expect(() => entryFromForm(form({ ...base, biweekly: "on" }), "t", "2026-11-10")).toThrow(/every-other-week/);
    expect(() => entryFromForm(form({ ...base, title: "x".repeat(200) }), "t", "2026-11-10")).toThrow(/too long/);
  });
});

describe("listings store (local file)", () => {
  it("starts from the seed file, and nothing goes live without approval", async () => {
    const seeds = loadSeeds();
    expect(seeds.length).toBeGreaterThan(0);
    expect((await liveListings()).length).toBe(seeds.length);

    const entry = entryFromForm(form(base), "Suggested on the site", "2026-11-10");
    const s = await submitSuggestion({ kind: "new", entry, note: "I play there" });
    expect((await pendingSuggestions()).map((p) => p.id)).toEqual([s.id]);
    expect((await liveListings()).length).toBe(seeds.length);

    await approve(s.id);
    expect((await liveListings()).some((l) => l.entry?.title === "Open Mic")).toBe(true);
    await expect(approve(s.id)).rejects.toThrow(/isn't waiting/);
  });

  it("applies an approved edit to the seed night, and removals take it down", async () => {
    const target = loadSeeds()[0];
    const edit = await submitSuggestion({ kind: "edit", targetId: target.id, entry: { ...target.entry!, start: "19:15" } });
    await approve(edit.id, undefined, new Date("2026-12-01T12:00:00Z"));
    const updated = (await liveListings()).find((l) => l.id === target.id)!;
    expect(updated.entry).toMatchObject({ start: "19:15", confirmedOn: "2026-12-01" });

    const declined = await submitSuggestion({ kind: "remove", targetId: target.id });
    await reject(declined.id);
    expect((await liveListings()).some((l) => l.id === target.id)).toBe(true);

    const removal = await submitSuggestion({ kind: "remove", targetId: target.id });
    await approve(removal.id);
    expect((await liveListings()).some((l) => l.id === target.id)).toBe(false);
    expect((await allListings()).find((l) => l.id === removal.id)?.status).toBe("applied");
  });

  it("lets the admin add, edit and remove nights directly", async () => {
    const id = await saveListing(undefined, entryFromForm(form(base), "admin", "2026-11-10"));
    await saveListing(id, entryFromForm(form({ ...base, start: "20:00" }), "admin", "2026-11-10"));
    expect((await liveListings()).find((l) => l.id === id)?.entry?.start).toBe("20:00");
    await removeListing(id);
    expect((await liveListings()).some((l) => l.id === id)).toBe(false);
  });
});
