import { describe, expect, it } from "vitest";
import { clip, eventJsonLd, isPast, slugify, townsWithEvents, venuePath } from "./site";
import type { MusicEvent } from "./types";

const ev = (over: Partial<MusicEvent> = {}): MusicEvent => ({
  id: "abc",
  title: "Friday Night Session",
  venueName: "Durty Nelly's",
  address: "1645 Argyle St",
  city: "Halifax",
  province: "NS",
  latitude: 44.6476,
  longitude: -63.5746,
  startDateTime: "2026-11-27T23:00:00.000Z",
  description: "Trad tunes </script> all night.",
  eventType: "LIVE_MUSIC",
  coverCharge: 10,
  sourceUrl: "https://example.com",
  verified: true,
  lastUpdated: "2026-11-23T00:00:00.000Z",
  ...over,
});

describe("site helpers", () => {
  it("makes plain url slugs", () => {
    expect(slugify("Annapolis Royal")).toBe("annapolis-royal");
    expect(slugify("Durty Nelly’s")).toBe("durty-nellys");
    expect(slugify("Café & Bar")).toBe("cafe-and-bar");
    expect(venuePath(ev())).toBe("/venues/durty-nellys-halifax");
  });

  it("clips at a word boundary", () => {
    expect(clip("one two three", 9)).toBe("one two…");
    expect(clip("short")).toBe("short");
  });

  it("builds MusicEvent data with place and price", () => {
    const d = eventJsonLd(ev()) as any;
    expect(d["@type"]).toBe("MusicEvent");
    expect(d.location.address.addressRegion).toBe("NS");
    expect(d.offers).toMatchObject({ price: 10, priceCurrency: "CAD" });
    expect(eventJsonLd(ev({ eventType: "OTHER" }))["@type"]).toBe("Event");
  });

  it("knows what's over and groups towns", () => {
    const now = new Date("2026-11-28T03:00:00Z");
    expect(isPast(ev(), now)).toBe(true); // started 4h ago, no end time
    expect(isPast(ev(), new Date("2026-11-27T12:00:00Z"))).toBe(false);
    const towns = townsWithEvents([ev(), ev({ id: "b", city: "Truro" }), ev({ id: "c" })], new Date("2026-11-27T12:00:00Z"));
    expect(towns.map((t) => [t.slug, t.events.length])).toEqual([["halifax", 2], ["truro", 1]]);
  });
});
