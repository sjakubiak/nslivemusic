import { describe, expect, it } from "vitest";
import { normaliseAddress, normaliseCover, normaliseDate, normaliseEvent, normaliseEventType, normaliseGenres, normaliseTime } from "./normalize";
import { dedupe, isDuplicate, titleSimilarity } from "./dedupe";
import { parseRobots } from "./polite-fetch";
import { extractJsonLdEvents } from "./sources/jsonld-venue";
import type { RawEvent } from "./types";

const NOW = new Date("2026-11-10T15:00:00Z");

describe("normalisation", () => {
  it("parses common date formats", () => {
    expect(normaliseDate("2026-11-14")).toBe("2026-11-14");
    expect(normaliseDate("Nov 14, 2026")).toBe("2026-11-14");
    expect(normaliseDate("11/14/2026")).toBe("2026-11-14");
    expect(normaliseDate("Saturday, November 14th", NOW)).toBe("2026-11-14");
    expect(normaliseDate("Jan 3", NOW)).toBe("2027-01-03"); // rolls to next year
    expect(normaliseDate("someday")).toBeNull();
  });
  it("parses times", () => {
    expect(normaliseTime("8pm")).toBe("20:00");
    expect(normaliseTime("8:30 PM")).toBe("20:30");
    expect(normaliseTime("12am")).toBe("00:00");
    expect(normaliseTime("20:00")).toBe("20:00");
    expect(normaliseTime("noon")).toBe("12:00");
    expect(normaliseTime("late")).toBeNull();
  });
  it("maps categories to event types", () => {
    expect(normaliseEventType("Open-Mic Night")).toBe("OPEN_MIC");
    expect(normaliseEventType("", "Sunday Kitchen Party")).toBe("JAM_SESSION");
    expect(normaliseEventType("karaoke")).toBe("KARAOKE");
    expect(normaliseEventType("concert")).toBe("LIVE_MUSIC");
  });
  it("canonicalises genres, cover and address", () => {
    expect(normaliseGenres(["trad", "Folk", "folk", "polka"])).toEqual(["Celtic", "Folk"]);
    expect(normaliseCover("$12.50")).toBe(12.5);
    expect(normaliseCover("PWYC")).toBe(0);
    expect(normaliseCover(undefined)).toBeUndefined();
    expect(normaliseAddress("1580 Lower Water St., Halifax, NS B3J 1S5", "Halifax")).toBe("1580 Lower Water Street");
  });
  it("converts Halifax local time to UTC across DST", () => {
    const base: RawEvent = { sourceId: "t", sourceUrl: "x", title: "Show", venueName: "Bluenose Brewhouse", date: "2026-11-14", startTime: "8pm" };
    expect(normaliseEvent(base, NOW).event!.startDateTime).toBe("2026-11-15T00:00:00.000Z"); // AST -4
    expect(normaliseEvent({ ...base, date: "2026-07-14" }, NOW).event!.startDateTime).toBe("2026-07-14T23:00:00.000Z"); // ADT -3
  });
  it("rolls end time past midnight", () => {
    const e = normaliseEvent({ sourceId: "t", sourceUrl: "x", title: "Late", venueName: "North End Cellar", date: "2026-11-13", startTime: "10pm", endTime: "2am" }, NOW).event!;
    expect(Date.parse(e.endDateTime!) - Date.parse(e.startDateTime)).toBe(4 * 3600_000);
  });
  it("rejects events it cannot place", () => {
    const r = normaliseEvent({ sourceId: "t", sourceUrl: "x", title: "?", venueName: "Unknown Place", date: "2026-11-14", startTime: "8pm" }, NOW);
    expect(r.event).toBeNull();
    expect(r.reason).toMatch(/coordinates/);
  });
});

describe("deduplication", () => {
  const mk = (over: Partial<RawEvent>) =>
    normaliseEvent({ sourceId: "t", sourceUrl: "x", title: "Tuesday Open Mic", venueName: "The Harbourside Taproom", date: "2026-11-17", startTime: "8pm", ...over }, NOW).event!;

  it("merges same venue + close start + similar title", () => {
    const a = mk({ verified: true, description: "Sign-up at 7:30", cover: "Free" });
    const b = mk({ venueName: "Harbourside Taproom", title: "TUESDAY OPEN MIC at Harbourside Taproom", startTime: "7:30pm" });
    expect(isDuplicate(a, b)).toBe(true);
    const { events, merged } = dedupe([a, b]);
    expect(merged).toBe(1);
    expect(events[0].verified).toBe(true);
    expect(events[0].title).toBe("Tuesday Open Mic");
    expect(events[0].coverCharge).toBe(0);
  });
  it("keeps different events at the same venue", () => {
    expect(isDuplicate(mk({}), mk({ title: "Gravel Road Revival", category: "concert", startTime: "9:30pm" }))).toBe(false);
    expect(isDuplicate(mk({}), mk({ date: "2026-11-24" }))).toBe(false); // next week
  });
  it("keeps same-titled events at different venues", () => {
    expect(isDuplicate(mk({}), mk({ venueName: "Orchard Lane Cider House" }))).toBe(false);
  });
  it("scores title similarity", () => {
    expect(titleSimilarity("Thursday Night Blues", "Thursday Blues Night")).toBe(1);
    expect(titleSimilarity("Jazz Jam", "Karaoke")).toBe(0);
  });
});

describe("scraping helpers", () => {
  it("honours robots.txt", () => {
    const txt = "User-agent: *\nDisallow: /private\n\nUser-agent: OtherBot\nDisallow: /";
    expect(parseRobots(txt)).toEqual(["/private"]);
  });
  it("extracts schema.org JSON-LD events", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicEvent","name":"Fiddle Night",
      "startDate":"2026-11-20T20:00:00-04:00","location":{"name":"Highland Crossing Pub","address":{"streetAddress":"201 Main St","addressLocality":"Antigonish"}},
      "offers":{"price":"10","url":"https://t.example"}}</script>`;
    const [raw] = extractJsonLdEvents(html, "https://venue.example/events");
    expect(raw.title).toBe("Fiddle Night");
    const e = normaliseEvent(raw, NOW).event!;
    expect(e.startDateTime).toBe("2026-11-21T00:00:00.000Z");
    expect(e.city).toBe("Antigonish");
    expect(e.coverCharge).toBe(10);
  });
});
