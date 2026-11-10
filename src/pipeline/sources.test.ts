import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandRRule, icsLocal, parseIcs, parseLocation } from "./sources/ical";
import { mapTribeEvent } from "./sources/wp-tribe";
import { mapEventbriteEvent } from "./sources/eventbrite";
import { mapFacebookEvent } from "./sources/facebook-pages";
import { expandManual } from "./sources/manual";
import { normaliseEvent } from "./normalize";
import { findVenue } from "./venues";
import { geocodeMissing, geocodeQuery } from "./geocode";
import { decodeEntities, htmlToText } from "./text";
import type { RawEvent } from "./types";

const NOW = new Date("2026-11-10T15:00:00Z"); // Tuesday, Halifax

describe("text helpers", () => {
  it("decodes entities and strips tags", () => {
    expect(decodeEntities("Paddy&#8217;s &amp; Rosie&#x27;s")).toBe("Paddy’s & Rosie's");
    expect(htmlToText("<p>Doors <b>8pm</b></p><p>19+</p>")).toBe("Doors 8pm\n19+");
  });
});

describe("iCal feeds", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:one-off@x",
    "DTSTART;TZID=America/Halifax:20261114T210000",
    "DTEND;TZID=America/Halifax:20261115T010000",
    "SUMMARY:Garrett Mason",
    "DESCRIPTION:Blues guitar\\, vocals.\\nNo cover before 9.",
    "LOCATION:Bearly's House of Blues & Ribs\\, 1579 Grafton St\\, Halifax\\, NS\\, B3J 2C3\\, Canada",
    "GEO:44.6452;-63.5752",
    "CATEGORIES:Blues",
    "URL:https://calendar.example/event/garrett-mason/",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:weekly@x",
    "DTSTART;TZID=America/Halifax:20261004T210000", // Sunday, during ADT
    "RRULE:FREQ=WEEKLY;BYDAY=SU",
    "EXDATE;TZID=America/Halifax:20261115T210000",
    "SUMMARY:Sunday Open Mic",
    "LOCATION:The Local\\, 2037 Gottingen St\\, Halifax",
    "BEGIN:VALARM",
    "SUMMARY:ignore me",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:old@x",
    "DTSTART:20250101T200000",
    "SUMMARY:Past show",
    "LOCATION:Somewhere",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:cxl@x",
    "DTSTART:20261120T200000",
    "STATUS:CANCELLED",
    "SUMMARY:Cancelled show",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const events = parseIcs(ics, { id: "test-feed", url: "https://feed.example/ics" }, NOW);

  it("reads a one-off event with venue, geo and escapes", () => {
    const e = events.find((x) => x.title === "Garrett Mason")!;
    expect(e.venueName).toBe("Bearly's House of Blues & Ribs");
    expect(e.address).toBe("1579 Grafton St");
    expect(e.city).toBe("Halifax");
    expect(e.latitude).toBeCloseTo(44.6452);
    expect(e.description).toBe("Blues guitar, vocals.\nNo cover before 9.");
    const n = normaliseEvent(e, NOW).event!;
    expect(n.startDateTime).toBe("2026-11-15T01:00:00.000Z"); // 9pm AST
    expect(Date.parse(n.endDateTime!) - Date.parse(n.startDateTime)).toBe(4 * 3600_000);
    expect(n.genre).toEqual(["Blues"]);
  });

  it("expands weekly RRULEs in Halifax time across DST, honouring EXDATE", () => {
    const opens = events.filter((x) => x.title === "Sunday Open Mic");
    expect(opens[0].date).toBe("2026-11-22"); // Nov 15 excluded
    expect(opens.every((o) => o.startTime === "21:00")).toBe(true);
    expect(opens.length).toBeGreaterThanOrEqual(5);
  });

  it("skips past, cancelled and nested-component data", () => {
    expect(events.some((x) => x.title === "Past show" || x.title === "Cancelled show" || x.title === "ignore me")).toBe(false);
  });

  it("converts UTC stamps to Halifax local", () => {
    expect(icsLocal({ name: "DTSTART", params: {}, value: "20260715T000000Z" })).toEqual({ day: "2026-07-14", time: "21:00" });
    expect(icsLocal({ name: "DTSTART", params: {}, value: "20261114" })).toEqual({ day: "2026-11-14" });
  });

  it("handles monthly nth-weekday, interval and count rules", () => {
    expect(expandRRule("FREQ=MONTHLY;BYDAY=2TU", "2026-01-13", "2026-11-01", "2026-12-31")).toEqual(["2026-11-10", "2026-12-08"]);
    expect(expandRRule("FREQ=MONTHLY;BYDAY=-1FR", "2026-01-30", "2026-11-01", "2026-11-30")).toEqual(["2026-11-27"]);
    expect(expandRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE", "2026-11-11", "2026-11-01", "2026-12-10")).toEqual(["2026-11-11", "2026-11-25", "2026-12-09"]);
    expect(expandRRule("FREQ=WEEKLY;COUNT=3", "2026-11-03", "2026-11-10", "2026-12-31")).toEqual(["2026-11-10", "2026-11-17"]);
  });

  it("uses the feed's venue for single-venue calendars", () => {
    const venue = { name: "Schoolhouse Brewery", city: "Windsor" };
    expect(parseLocation("", venue).venueName).toBe("Schoolhouse Brewery");
    expect(parseLocation("40 Water St, Windsor", venue)).toEqual({ venueName: "Schoolhouse Brewery", address: "40 Water St", city: "Windsor" });
  });
});

describe("WordPress Events Calendar API", () => {
  it("maps events using the UTC start", () => {
    const r = mapTribeEvent(
      {
        title: "Jazz @ the Lion&#8217;s Head!",
        url: "https://x.example/event/jazz/",
        utc_start_date: "2026-11-18 23:30:00",
        start_date: "2026-11-18 19:30:00",
        end_date: "2026-11-18 22:30:00",
        cost: "Free",
        image: false,
        venue: { venue: "Lion's Head Tavern", address: "3085 Robie St", city: "Halifax", geo_lat: "44.66", geo_lng: "-63.60" },
        categories: [{ name: "Jazz" }],
      },
      { id: "t" },
    )!;
    expect(r.title).toBe("Jazz @ the Lion’s Head!");
    const n = normaliseEvent(r, NOW).event!;
    expect(n.startDateTime).toBe("2026-11-18T23:30:00.000Z");
    expect(n.coverCharge).toBe(0);
    expect(n.genre).toEqual(["Jazz"]);
    expect(n.eventType).toBe("LIVE_MUSIC");
  });
  it("skips all-day events", () => {
    expect(mapTribeEvent({ title: "Festival", url: "u", start_date: "2026-11-18 00:00:00", all_day: true }, { id: "t" })).toBeNull();
  });
});

describe("Eventbrite and Facebook mappers", () => {
  it("keeps in-person Nova Scotia Eventbrite events only", () => {
    const base = {
      name: { text: "Kitchen Party" },
      url: "https://www.eventbrite.ca/e/1",
      start: { utc: "2026-11-21T23:00:00Z" },
      is_free: false,
      ticket_availability: { minimum_ticket_price: { major_value: "25.00" } },
      venue: { name: "Celtic Music Interpretive Centre", address: { address_1: "5473 Route 19", city: "Judique", region: "NS", latitude: "45.92", longitude: "-61.49" } },
    };
    const r = mapEventbriteEvent(base)!;
    expect(normaliseEvent(r, NOW).event!.coverCharge).toBe(25);
    expect(normaliseEvent(r, NOW).event!.eventType).toBe("JAM_SESSION");
    expect(mapEventbriteEvent({ ...base, online_event: true })).toBeNull();
    const comedy = mapEventbriteEvent({ ...base, name: { text: "Comedy Open Mic" }, category_id: "105", category: { name: "Performing & Visual Arts" } })!;
    expect(normaliseEvent(comedy, NOW).event!.eventType).toBe("OTHER");
    expect(normaliseEvent(mapEventbriteEvent({ ...base, category_id: "103" })!, NOW).event!.eventType).toBe("JAM_SESSION");
    expect(mapEventbriteEvent({ ...base, venue: { ...base.venue, address: { ...base.venue.address, region: "NB" } } })).toBeNull();
  });
  it("normalises Graph API offsets", () => {
    const r = mapFacebookEvent({
      id: "42",
      name: "Trad Session",
      start_time: "2026-11-14T20:00:00-0400",
      place: { name: "Paddy's Brewpub", location: { city: "Wolfville", state: "NS", latitude: 45.09, longitude: -64.36 } },
    })!;
    expect(normaliseEvent(r, NOW).event!.startDateTime).toBe("2026-11-15T00:00:00.000Z");
    expect(mapFacebookEvent({ id: "1", name: "x", start_time: "2026-11-14T20:00:00-0400", is_canceled: true })).toBeNull();
  });
});

describe("manual entries", () => {
  it("expands weekly nights and one-offs within the horizon", () => {
    const out = expandManual(
      [
        { title: "Blues Jam", venue: "Bearly's", city: "Halifax", weekly: ["SU"], start: "8pm", source: "venue post", confirmedOn: "2026-11-01" },
        { title: "Album Launch", venue: "The Carleton", city: "Halifax", date: "2026-11-20", start: "20:00", source: "email", confirmedOn: "2026-11-09" },
        { title: "Old", venue: "The Carleton", city: "Halifax", date: "2026-10-01", start: "20:00", source: "email", confirmedOn: "2026-09-01" },
      ],
      NOW,
    );
    const jams = out.filter((e) => e.title === "Blues Jam");
    expect(jams[0].date).toBe("2026-11-15");
    expect(jams.length).toBe(6);
    expect(out.filter((e) => e.title === "Album Launch")).toHaveLength(1);
    expect(out.some((e) => e.title === "Old")).toBe(false);
  });
});

describe("hand-entered weekly nights (data/manual-events.json)", () => {
  it("every entry is complete, in Nova Scotia time and expands to events", async () => {
    const fs = await import("node:fs");
    const { events } = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "manual-events.json"), "utf8"));
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.title && e.venue && e.city && e.source && e.confirmedOn).toBeTruthy();
      expect(e.start).toMatch(/^\d{2}:\d{2}$/);
      expect(e.weekly ?? e.date).toBeTruthy();
      if (e.biweekly) expect(e.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const raw = expandManual(events, new Date(`${events[0].confirmedOn}T16:00:00Z`));
    for (const e of events) expect(raw.some((r) => r.title === e.title && r.venueName === e.venue)).toBe(true);
  });
});

describe("real venue registry and geocoding", () => {
  it("matches aliases and respects towns", () => {
    expect(findVenue("Bearlys", "Halifax")?.name).toBe("Bearly's House of Blues & Ribs");
    expect(findVenue("Red Shoe")?.city).toBe("Mabou");
    expect(findVenue("The Local", "Truro")).toBeUndefined();
  });
  it("falls back to the town when OpenStreetMap doesn't know the venue", async () => {
    process.env.GEOCODE_CACHE = path.join(os.tmpdir(), `geocode-town-${Date.now()}.json`);
    const calls: string[] = [];
    const raws = [{ sourceId: "manual", title: "Jam", venueName: "Firemen's Club", address: "7811 Cabot Trail", city: "Margaree Forks", date: "2026-11-12", startTime: "19:00" }] as RawEvent[];
    const filled = await geocodeMissing(raws, async (q) => (calls.push(q), q.startsWith("Margaree Forks") ? { lat: 46.33, lng: -61.1 } : null));
    expect(calls).toEqual(["7811 Cabot Trail, Margaree Forks, Nova Scotia, Canada", "Margaree Forks, Nova Scotia, Canada"]);
    expect(filled).toBe(1);
    expect(raws[0].latitude).toBe(46.33);
  });

  it("geocodes by street address and caches results", async () => {
    process.env.GEOCODE_CACHE = path.join(os.tmpdir(), `geocode-test-${process.pid}.json`);
    expect(geocodeQuery({ venueName: "Bearlys", city: "Halifax" })).toBe("1269 Barrington Street, Halifax, Nova Scotia, Canada");
    expect(geocodeQuery({ venueName: "Red Shoe", city: "Mabou" })).toBe("Red Shoe, Mabou, Nova Scotia, Canada");
    const calls: string[] = [];
    const raws: RawEvent[] = [
      { sourceId: "t", sourceUrl: "x", title: "A", venueName: "Zzz Test Venue", address: "1 Test Rd", city: "Testville", date: "2026-11-14", startTime: "8pm" },
      { sourceId: "t", sourceUrl: "x", title: "B", venueName: "Zzz Test Venue", address: "1 Test Rd", city: "Testville", date: "2026-11-15", startTime: "8pm" },
    ];
    const filled = await geocodeMissing(raws, async (q) => (calls.push(q), { lat: 45, lng: -63 }));
    expect(filled).toBe(2);
    expect(calls.length).toBeLessThanOrEqual(1); // second is served from cache
    expect(raws[1].latitude).toBe(45);
  });
});

describe("feed quirks seen in the wild", () => {
  it("drops an end time equal to the start and assumes the feed's town", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:q@x",
      "DTSTART;TZID=America/Halifax:20261118T193000",
      "DTEND;TZID=America/Halifax:20261118T193000",
      "SUMMARY:String Quartets: ancient & modern",
      "LOCATION:The Music Room\\, 6181 Lady Hammond Road",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [raw] = parseIcs(ics, { id: "f", url: "u", defaultCity: "Halifax" }, NOW);
    expect(raw.city).toBe("Halifax");
    const n = normaliseEvent({ ...raw, latitude: 44.67, longitude: -63.6 }, NOW).event!;
    expect(n.endDateTime).toBeUndefined();
    expect(n.venueName).toBe("The Music Room");
  });
});

describe("feed URLs", () => {
  it("expands {month} to this month and next, across a year end", async () => {
    const { feedUrls } = await import("./feeds");
    const f = { id: "x", name: "x", kind: "ical" as const, url: "https://x/events/month/{month}/?ical=1", region: "", permission: "pending" as const, note: "" };
    expect(feedUrls(f, new Date("2026-12-15T12:00:00Z"))).toEqual(["https://x/events/month/2026-12/?ical=1", "https://x/events/month/2027-01/?ical=1"]);
  });
});

describe("blocklist", () => {
  it("never links to or fetches blocked sites", async () => {
    const { isBlocked } = await import("./blocklist");
    const { safeUrl } = await import("./normalize");
    expect(isBlocked("https://livemusichalifax.ca/events/")).toBe(true);
    expect(isBlocked("https://www.livemusichalifax.ca/x")).toBe(true);
    expect(isBlocked("https://oldtriangle.com/")).toBe(false);
    expect(safeUrl("https://livemusichalifax.ca/event/x/")).toBeUndefined();
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("https://oldtriangle.com/event/x/")).toBe("https://oldtriangle.com/event/x/");
  });
});

describe("public calendar subscriptions", () => {
  it("recognises only public Google Calendar .ics addresses", async () => {
    const { isPublicCalendarSubscription } = await import("./polite-fetch");
    expect(isPublicCalendarSubscription("https://calendar.google.com/calendar/ical/splitcrow.halifax%40gmail.com/public/basic.ics")).toBe(true);
    expect(isPublicCalendarSubscription("https://calendar.google.com/calendar/embed?src=x")).toBe(false);
    expect(isPublicCalendarSubscription("https://calendar.google.com/calendar/ical/x/private-abc/basic.ics")).toBe(false);
  });
});
