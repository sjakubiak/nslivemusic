# Nova Scotia Live Music Finder

Find live music, open mics, jam sessions and karaoke at pubs, breweries, restaurants and community venues across Nova Scotia, on a map or in a searchable list, with one-tap driving directions.

Built from the v1.0 spec: Next.js 15 (App Router) + React 19 + TypeScript, Leaflet with marker clustering on OpenStreetMap tiles. No API keys needed.

> **Sample data:** until a real source returns events, the app shows events from 16 *fictional* venues placed in real NS towns, with dates generated relative to today. Real sources (hand-entered events, venue/community iCal feeds, WordPress event calendars, Eventbrite, venue-granted Facebook Pages) are built and switch on as permissions come in. See [docs/SOURCES.md](docs/SOURCES.md).

## Quick start

```bash
npm install
npm run dev        # runs the ingest pipeline, then http://localhost:3000
npm test           # unit tests: normalisation, dedup, filters, directions
npm run build && npm start
```

## Features

| Spec item | Where |
| --- | --- |
| Map view: clustering, colour-coded types (blue live / green open mic / purple jam / orange karaoke), zoom/pan, **My Location** button, popups with title, venue, time, genre, Directions + Details | `src/components/EventMap.tsx` |
| List view: cards with image, title, venue, location, date/time, type, distance, directions; sort soonest / closest / A–Z | `src/components/EventCard.tsx`, `Finder.tsx` |
| Search: venue, city, title, genre, event type (`Halifax`, `Open Mic`, `Celtic`, `Bearlys` all work; apostrophes ignored) | `src/lib/filters.ts` |
| Filters: type, date (today / tomorrow / this weekend / next 7 days / custom range), distance (10/25/50/100 km), genre | `src/lib/filters.ts` |
| Directions from current location or an entered town: Google Maps (`/maps/dir/?api=1&destination=lat,lng`) and Apple Maps (`maps.apple.com/?daddr=`) | `src/lib/directions.ts` |
| Event details page with image, description, venue, date/time, genre, cover, links, directions and a map snippet | `src/app/events/[id]/page.tsx` |
| JSON API: `GET /api/events?q=&type=OPEN_MIC,JAM_SESSION&date=WEEKEND&genre=Celtic&lat=&lng=&radius=25&sort=CLOSEST` | `src/app/api/events/route.ts` |

All date logic runs in `America/Halifax`, so a 9 pm show counts as “today” even though it's tomorrow in UTC. Desktop shows list and map side by side (hovering a card highlights its marker); on phones there's a List/Map toggle.

## Data ingestion

```
Sources (src/pipeline/sources/*)  →  normalize.ts  →  dedupe.ts  →  data/events.json
```

`npm run ingest` runs the whole pipeline (it also runs automatically before `dev` and `build`). Schedule it every few hours with cron or your host's scheduler. `src/lib/events-store.ts` is the only thing that reads the JSON file, so swapping in Postgres/PostGIS later is a one-file change.

**Sources**

Real sources (see [docs/SOURCES.md](docs/SOURCES.md) for the venue research and how to switch each on):

- `manual`: hand-entered or venue-submitted events in `data/manual-events.json`, one-off or weekly.
- `ical`: iCalendar feeds listed in `feeds.ts` (Google Calendar, WordPress "?ical=1", Squarespace), with RRULE/EXDATE support. Each feed stays off until its owner says yes.
- `wp-tribe`: WordPress "The Events Calendar" JSON API, for sites whose robots.txt allows it.
- `jsonld-venue`: venue pages with schema.org `Event` JSON-LD (`VENUE_PAGES`).
- `eventbrite`: official API, organizer-scoped (`EVENTBRITE_TOKEN`, `EVENTBRITE_ORGANIZER_IDS`).
- `facebook-pages`: Graph API for venue Pages that grant a token (`FACEBOOK_PAGES`). We never scrape facebook.com.

Sample sources: `sample-venues` / `sample-listing` are offline generators. The listing source re-lists a third of the venue events with different wording, so dedup has real work. `SAMPLE_DATA=auto` (default) uses them only when no real source returned events; `on` / `off` force it.

Events still missing coordinates after the venue registry (`venues-ns.ts`, real venues; `venues.ts`, samples) are geocoded with OpenStreetMap Nominatim and cached.

**Scraping etiquette** (`polite-fetch.ts`): descriptive User-Agent, robots.txt honoured, max one request per host every 5 s. Every source also carries a `termsNote` documenting why collection is allowed.

**Normalisation** standardises dates (`2026-11-14`, `Nov 14, 2026`, `11/14/2026`, `Saturday, November 14th`), times (`8pm`, `8:30 PM`, `20:00`, `noon`), end times past midnight, Halifax→UTC with DST, addresses (strips city/province/postal code, expands St./Ave./Rd.), event categories (“open-mic night”, “trad session”, “kitchen party” → the four types), genres (trad → Celtic, Americana → Country, indie → Rock …) and cover (`$10`, `Free`, `PWYC`). Venues missing coordinates are geocoded against the venue registry (`venues.ts`); anything still unplaceable is rejected and logged.

### Deduplication rules (assumed)

The spec cut off at “Events are duplicates when: Same venue”. The implemented rules, all tunable in `src/pipeline/dedupe.ts`:

Two events are duplicates when **all** of these hold:

1. **Same venue:** normalised venue names match (“The Rusty Anchor Pub” = “Rusty Anchor”), or the coordinates are within 75 m.
2. **Same start:** start times within 90 minutes (covers doors-vs-show time and rounding).
3. **Similar title:** one title contains the other, or token overlap (Jaccard) ≥ 0.5, or both are the same event type starting within 30 minutes.

On merge, the verified/more complete record wins, missing fields are filled from the other, genres are unioned and `verified` is kept if either source was verified.

## Future work

- In-app route preview (OSRM or Mapbox Directions) with travel time and distance
- Real database + geocoder (Nominatim) for free-text “entered location”
- Venue/promoter submission form and verification workflow
- Festivals event type
