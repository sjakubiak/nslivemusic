import { NS_VENUES } from "../pipeline/venues-ns";

/**
 * Where the auto-finder starts. Listing pages are crawled for links to venue
 * websites; venue websites are crawled for event pages and feeds. Add any page
 * that lists NS venues or events here.
 */
export const LISTING_PAGES: string[] = [
  "https://livemusichalifax.ca/events/list/",
  "https://www.novascotia.com/trip-ideas/stories/8-downtown-halifax-pubs-with-live-music",
  "https://novascotia.com/blog/enjoy-halifaxs-vibrant-live-music-scene-all-year-long/",
  "https://discoverhalifaxns.com/things-to-do/nightlife/where-to-see-live-music-in-halifax/",
  "https://tasteofnovascotia.com/brews-bands-halifax-metro/",
  "https://tasteofnovascotia.com/brews-bands-bay-of-fundy-annapolis-valley/",
  "https://tasteofnovascotia.com/brews-bands-cape-breton/",
  "https://www.cbisland.com/en/things-to-do/music-events/live-music-ceilidhs",
  "https://valleyevents.ca/",
];

export const VENUE_SITES: string[] = [
  ...new Set(NS_VENUES.map((v) => v.website).filter((w): w is string => Boolean(w))),
  "https://schoolhousebrewery.ca/events/",
  "https://crystanysbrasserie.com/live-music",
];
