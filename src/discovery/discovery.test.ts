import { describe, expect, it } from "vitest";
import { detectSources } from "./detect";
import { mergeFound } from "./store";

describe("detectSources", () => {
  const html = `
    <link rel="alternate" type="text/calendar" title="Events" href="/events/feed.ics">
    <iframe src="https://calendar.google.com/calendar/embed?src=venue%40gmail.com&amp;ctz=America%2FHalifax"></iframe>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicEvent","name":"Fiddle Night","startDate":"2026-11-20T20:00"}</script>
    <a href="https://www.eventbrite.ca/o/mill-cove-brew-pub-75673481143">Organizer</a>
    <a href="https://www.eventbrite.ca/e/fog-live-at-stage1-tickets-1982334496843?aff=x">Tickets</a>
    <a href="/whats-on">What's on</a>
    <a href="/menu">Menu</a>
    <a href="/poster.jpg">Poster</a>
    <a href="https://www.facebook.com/venue">FB</a>
    <a href="https://othervenue.ca/live-music">Other venue</a>
    <a href="webcal://cal.example.org/shows.ics">Subscribe</a>`;
  const d = detectSources(html, "https://venue.example/");

  it("finds every kind of calendar feed", () => {
    expect(d.icalUrls).toContain("https://venue.example/events/feed.ics");
    expect(d.icalUrls).toContain("https://calendar.google.com/calendar/ical/venue%40gmail.com/public/basic.ics");
    expect(d.icalUrls).toContain("https://cal.example.org/shows.ics");
    expect(d.hasJsonLdEvents).toBe(true);
  });
  it("reads Eventbrite IDs from links without crawling Eventbrite", () => {
    expect(d.eventbriteOrganizerIds).toEqual(["75673481143"]);
    expect(d.eventbriteEventIds).toEqual(["1982334496843"]);
  });
  it("follows event-ish same-site links and non-social external sites", () => {
    expect(d.eventPageLinks).toEqual(["https://venue.example/whats-on"]);
    expect(d.externalLinks).toEqual(["https://othervenue.ca/"]);
  });
  it("turns a WordPress Events Calendar site into its month export", () => {
    const wp = detectSources(`<div class="tribe-events-calendar"></div><a href="https://wp.example/events/x/?ical=1">ics</a>`, "https://wp.example/events/list/");
    expect(wp.icalUrls).toEqual(["https://wp.example/events/month/{month}/?ical=1"]);
  });
});

describe("mergeFound", () => {
  it("keeps first-seen dates and drops entries not seen for 60 days", () => {
    const prev = [
      { key: "a", foundOn: "p", firstSeen: "2026-09-01", lastSeen: "2026-11-01" },
      { key: "old", foundOn: "p", firstSeen: "2026-01-01", lastSeen: "2026-08-01" },
    ];
    const out = mergeFound(prev, [{ key: "a", foundOn: "p2" }, { key: "b", foundOn: "p" }], new Date("2026-11-10T00:00:00Z"));
    expect(out.map((f) => f.key)).toEqual(["a", "b"]);
    expect(out[0]).toMatchObject({ firstSeen: "2026-09-01", lastSeen: "2026-11-10", foundOn: "p2" });
  });
});

describe("discovered feed clean-up", () => {
  it("keeps one feed per site and maps venue sites to registry venues", async () => {
    const { pickOnePerSite, venueForSite } = await import("../pipeline/feeds");
    expect(
      pickOnePerSite([
        "https://oldtriangle.com/events/?ical=1",
        "https://oldtriangle.com/events/month/?outlook-ical=1",
        "https://www.oldtriangle.com/events/month/{month}/?ical=1",
        "https://durtynellys.ca/events/list/?outlook-ical=1",
        "https://durtynellys.ca/events/month/{month}/?ical=1",
      ]),
    ).toEqual(["https://www.oldtriangle.com/events/month/{month}/?ical=1", "https://durtynellys.ca/events/month/{month}/?ical=1"]);
    expect(venueForSite("https://durtynellys.ca/events/")?.name).toBe("Durty Nelly's Irish Pub");
  });
});
