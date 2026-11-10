import { describe, expect, it } from "vitest";
import { dateRange, queryEvents } from "./filters";
import { appleDirectionsUrl, googleDirectionsUrl } from "./directions";
import type { MusicEvent } from "./types";

// Tuesday 10 Nov 2026, 11:00 Halifax
const NOW = new Date("2026-11-10T15:00:00Z");

const ev = (over: Partial<MusicEvent>): MusicEvent => ({
  id: Math.random().toString(36), title: "Show", venueName: "V", address: "1 St", city: "Halifax", province: "NS",
  latitude: 44.65, longitude: -63.57, startDateTime: "2026-11-11T00:00:00Z", description: "", eventType: "LIVE_MUSIC",
  genre: [], sourceUrl: "x", verified: true, lastUpdated: NOW.toISOString(), ...over,
});

describe("date filters (Halifax time)", () => {
  it("computes ranges", () => {
    expect(dateRange("TODAY", NOW)).toEqual(["2026-11-10", "2026-11-10"]);
    expect(dateRange("TOMORROW", NOW)).toEqual(["2026-11-11", "2026-11-11"]);
    expect(dateRange("WEEKEND", NOW)).toEqual(["2026-11-13", "2026-11-15"]);
    expect(dateRange("NEXT_7", NOW)).toEqual(["2026-11-10", "2026-11-16"]);
    expect(dateRange("WEEKEND", new Date("2026-11-14T15:00:00Z"))).toEqual(["2026-11-14", "2026-11-15"]);
  });
  it("treats 9pm Halifax as 'today' even though it's tomorrow in UTC", () => {
    const tonight = ev({ startDateTime: "2026-11-11T01:00:00Z" }); // 9pm AST on the 10th
    expect(queryEvents([tonight], { date: "TODAY" }, NOW)).toHaveLength(1);
  });
});

describe("queryEvents", () => {
  const events = [
    ev({ title: "Celtic Night", genre: ["Celtic"], venueName: "Bearly's", eventType: "LIVE_MUSIC" }),
    ev({ title: "Open Mic", eventType: "OPEN_MIC", city: "Sydney", latitude: 46.13, longitude: -60.19, startDateTime: "2026-11-12T00:00:00Z" }),
    ev({ title: "Past", startDateTime: "2026-11-01T00:00:00Z" }),
  ];
  it("searches title, venue, city and genre", () => {
    expect(queryEvents(events, { search: "celtic" }, NOW).map((e) => e.title)).toEqual(["Celtic Night"]);
    expect(queryEvents(events, { search: "bearlys" }, NOW)).toHaveLength(1);
    expect(queryEvents(events, { search: "open mic" }, NOW)).toHaveLength(1);
    expect(queryEvents(events, { search: "sydney" }, NOW)).toHaveLength(1);
  });
  it("hides past events, filters type/genre/radius, sorts by distance", () => {
    expect(queryEvents(events, {}, NOW)).toHaveLength(2);
    expect(queryEvents(events, { types: ["OPEN_MIC"] }, NOW)).toHaveLength(1);
    expect(queryEvents(events, { genre: "Celtic" }, NOW)).toHaveLength(1);
    const sydney = { lat: 46.14, lng: -60.19 };
    expect(queryEvents(events, { origin: sydney, radiusKm: 10 }, NOW).map((e) => e.title)).toEqual(["Open Mic"]);
    expect(queryEvents(events, { origin: sydney, sort: "CLOSEST" }, NOW)[0].title).toBe("Open Mic");
    expect(queryEvents(events, { sort: "ALPHA" }, NOW)[0].title).toBe("Celtic Night");
  });
});

describe("directions links", () => {
  it("builds Google and Apple URLs", () => {
    expect(googleDirectionsUrl({ lat: 44.6, lng: -63.5 })).toBe("https://www.google.com/maps/dir/?api=1&destination=44.6%2C-63.5&travelmode=driving");
    expect(appleDirectionsUrl({ lat: 44.6, lng: -63.5 }, { lat: 45, lng: -64 })).toBe("https://maps.apple.com/?daddr=44.6%2C-63.5&dirflg=d&saddr=45%2C-64");
  });
});
