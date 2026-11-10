# Real event sources

Where real Nova Scotia live-music listings come from, how the app collects each one, and what's needed to switch it on. Research done 2026-11-10.

Until at least one real source returns events, the app keeps showing the fictional sample data (and the "Sample data" badge). As soon as a real source produces events, sample data turns off automatically (`SAMPLE_DATA=auto`).

## Auto-finder

`npm run discover` (run daily by the "Auto-finder" GitHub Action) crawls the listing pages and venue websites in `src/discovery/seeds.ts`, follows links from listings to venue sites and from venue home pages to their event pages, and records what it finds in `data/discovered.json`:

- **Calendar feeds:** `<link type="text/calendar">`, `.ics` and `webcal:` links, embedded Google Calendars (turned into their public iCal address) and WordPress Events Calendar sites (turned into their month export).
- **Pages with schema.org Event data.**
- **Eventbrite organizers:** read straight from `/o/` links, or resolved from `/e/` event links through the API. The latter needs the `EVENTBRITE_TOKEN` repository secret.

Discovered sources are used by the next ingest automatically. Set `DISABLE_DISCOVERED=1` to ignore them. The finder goes through `politeFetch` (robots.txt, 5 seconds per host), caps pages per site, and never crawls social media or ticketing sites. Events outside Nova Scotia are dropped. To widen the net, add pages to `seeds.ts`.

Planned: AI extraction for plain-text schedules, and web search for new venues. Each needs an API key.

## How to switch a source on

| Source | Code | What you need |
| --- | --- | --- |
| Hand-entered / venue-submitted | `sources/manual.ts`, `data/manual-events.json` | Nothing. Add entries and redeploy. |
| iCal feeds (Google Calendar, WordPress "?ical=1", Squarespace…) | `sources/ical.ts`, list in `feeds.ts` | The site owner's OK, then set `permission: "granted"` |
| WordPress The Events Calendar API | `sources/wp-tribe.ts`, list in `feeds.ts` | Same, and the site's robots.txt must allow `/wp-json` |
| Venue pages with schema.org JSON-LD | `sources/jsonld-venue.ts` (`VENUE_PAGES`) | Terms checked, robots.txt allows it |
| Eventbrite | `sources/eventbrite.ts` | `EVENTBRITE_TOKEN` + `EVENTBRITE_ORGANIZER_IDS` env vars on Render |
| Facebook venue Pages | `sources/facebook-pages.ts` | A Meta app with App Review, plus each venue granting a Page token |

To test a pending feed without marking it granted: `ENABLE_FEEDS=<feed id> npm run ingest`.

Events missing coordinates are geocoded with OpenStreetMap Nominatim (cached in `data/geocode-cache.json`). Set `SCRAPER_USER_AGENT` on Render to something with a contact address, e.g. `NSLiveMusicFinderBot/1.0 (+mailto:you@example.com)`.

## Best sources found, by region

### Halifax / Dartmouth

- **Blocked sites:** livemusichalifax.ca was reported on 2026-11-10 as serving a scam page that infected a visitor's browser. It and a few sites found through it are listed in `src/pipeline/blocklist.ts`, and the app never fetches or links to anything on that list.
- Downtown pubs with regular live music (from Tourism NS's "8 downtown Halifax pubs with live music"): Old Triangle (7 nights/week), Durty Nelly's (5 nights/week), Split Crow, Bearly's (nearly nightly), Lower Deck, Loose Cannon, Carleton, Stubborn Goat, Auction House, plus 2037 Gottingen (Marquee, Seahorse, The Local) and Gus' Pub. Most of these post their schedules on Facebook/Instagram rather than on a calendar page, so the practical routes are Eventbrite/ticketing for the ticketed rooms, or manual entry.

### Annapolis Valley, Hants, Colchester

From Taste of Nova Scotia's "Brews & Bands" guide: Schoolhouse Brewery (Windsor, has an events page at schoolhousebrewery.ca/events/), Crystany's Brasserie (Canning, crystanysbrasserie.com/live-music), Paddy's Brewpub (Wolfville and Kentville: sessions and open mics), The Nook and Cranny (Truro: live music every Tue, Wed and Thu), Union Street (Berwick), Oaken Barrel, WINEGRUNT. Check whether the two venue pages embed JSON-LD or offer an iCal link. If they do, add them to `VENUE_PAGES` or `feeds.ts`; if not, use manual entry.

### Cape Breton

Destination Cape Breton (cbisland.com) has a live music and ceilidh listing: Celtic Music Interpretive Centre (Judique, Sunday ceilidhs), Red Shoe Pub (Mabou, live music daily in season), Daniel's Taphouse (Sydney, Sunday blues and Friday jazz), Frolic'n Folk (Iona), plus Legion and community halls. There's no public feed, and the site is "All Rights Reserved", so ask Destination Cape Breton about a data partnership (they want visitors to find these shows) or enter the recurring nights by hand.

### Province-wide

- **Tourism Nova Scotia** (novascotia.com/all-events) lists festivals and some recurring music. There's no export on the page; ask about a partner feed.
- **Eventbrite**: the official API only lists events by organizer (there's no search). Starting organizers are in `DEFAULT_ORGANIZERS` in `sources/eventbrite.ts` (Mill Cove Brew Pub, Monte's Showbar Grill). Add more with the `EVENTBRITE_ORGANIZER_IDS` env var. Non-music Eventbrite events are listed as "Other Events". The token must be the **Private token** from eventbrite.com/platform/api-keys.
- **Songkick / Bandsintown**: their APIs are partner-only or artist-scoped, so they're not useful for venue listings without a partnership.

## Facebook: what's realistic

A lot of NS pubs only post gigs on Facebook, so this is the hard one.

- **Scraping facebook.com isn't an option.** Meta's terms prohibit automated collection, they block it aggressively (logins, rate limits, layout changes), and they have sued scrapers. A scraper would also need a logged-in account, which would get banned.
- **The Graph API only covers Pages that grant access.** Meta shut down public event search years ago. A venue admin can grant our Meta app access to their Page, and then `/{page-id}/events` returns its events. This needs a Meta developer app that passes App Review for `pages_read_engagement`, plus one click from each venue. `sources/facebook-pages.ts` is written for this but is untested until we have a token.
- **What works today:**
  1. **Venues submit their own events.** A simple form or email address, which we enter into `data/manual-events.json`. A good v2 feature: a submission form with a verification step.
  2. **Venues share a Google Calendar.** Many venues will happily paste their gigs into a free Google Calendar and give us its public iCal URL. That drops straight into `feeds.ts`, with no Facebook involved.
  3. **Manual entry of recurring nights.** Most "every Tuesday open mic" nights are stable. Enter them once with `weekly` and re-check them every 90 days (ingest warns when one is stale).

## Manual entry format

`data/manual-events.json`:

```json
{
  "events": [
    {
      "title": "Sunday Night Blues Jam",
      "venue": "Bearly's House of Blues & Ribs",
      "city": "Halifax",
      "weekly": ["SU"],
      "start": "20:00",
      "end": "23:30",
      "category": "blues jam",
      "genres": ["Blues"],
      "cover": "Free",
      "source": "https://www.bearlys.ca/ (checked by phone)",
      "confirmedOn": "2026-11-10"
    },
    {
      "title": "Album release show",
      "venue": "The Carleton",
      "city": "Halifax",
      "date": "2026-11-28",
      "start": "8pm",
      "cover": "$20",
      "ticketUrl": "https://…",
      "source": "venue email",
      "confirmedOn": "2026-11-10"
    }
  ]
}
```

(The example times are placeholders. Confirm real times before adding an entry.)

## Permission email template

> Subject: Listing your shows on NS Live Music Finder
>
> Hi, I'm building a free map of live music, open mics and sessions across Nova Scotia (nslivemusic.onrender.com). I'd love to include your listings by reading your calendar's iCal export a few times a day, with each event linking back to your page. Would that be OK? If you'd prefer, you can also send us your schedule, or tell us any events you'd rather we leave out.
