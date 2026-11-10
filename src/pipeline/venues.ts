/**
 * Venue registry. Used to geocode/standardise scraped events whose source only
 * gives a venue name, and by the sample sources to generate demo data.
 *
 * VENUES are fictional sample venues placed in real Nova Scotia towns, used
 * only by the sample sources. Real venues live in venues-ns.ts.
 */
import { NS_VENUES } from "./venues-ns";

export interface Weekly {
  weekday: number; // 0 = Sunday
  start: string; // "HH:MM" Halifax time
  end?: string;
  title: string;
  category: string;
  genres?: string[];
  cover?: string;
  description: string;
  /** Every other week, for variety. */
  biweekly?: boolean;
}

export interface Venue {
  key: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  website: string;
  kind: "pub" | "bar" | "brewery" | "restaurant" | "community" | "venue";
  weekly: Weekly[];
  /** Pool of touring/local acts for one-off weekend shows. */
  acts?: { name: string; genres: string[]; cover?: string; blurb: string }[];
}

export const VENUES: Venue[] = [
  {
    key: "harbourside-taproom",
    name: "The Harbourside Taproom",
    address: "1580 Lower Water Street",
    city: "Halifax",
    latitude: 44.6447,
    longitude: -63.5703,
    website: "https://example.com/harbourside-taproom",
    kind: "pub",
    weekly: [
      { weekday: 2, start: "20:00", end: "23:00", title: "Tuesday Open Mic", category: "open mic night", genres: ["Folk", "Pop", "Rock"], cover: "Free", description: "Sign-up sheet opens at 7:30. Three songs or 15 minutes per performer. House PA, two mics, and a keyboard provided." },
      { weekday: 4, start: "21:00", end: "00:30", title: "Thursday Night Blues", category: "live band", genres: ["Blues"], cover: "$5", description: "The house blues band plays three sets, with guest sit-ins welcome in the third." },
    ],
    acts: [
      { name: "The Salt Spray Sisters", genres: ["Celtic", "Folk"], cover: "$10", blurb: "Tight three-part harmonies and twin fiddles from the South Shore." },
      { name: "Gravel Road Revival", genres: ["Country", "Rock"], cover: "$12", blurb: "Hard-driving country rock for a full dance floor." },
    ],
  },
  {
    key: "bluenose-brewhouse",
    name: "Bluenose Brewhouse",
    address: "2112 Gottingen Street",
    city: "Halifax",
    latitude: 44.6559,
    longitude: -63.5847,
    website: "https://example.com/bluenose-brewhouse",
    kind: "brewery",
    weekly: [
      { weekday: 3, start: "19:30", end: "22:30", title: "Wednesday Jazz Jam", category: "jazz jam session", genres: ["Jazz"], cover: "PWYC", description: "House trio plays the first set, then the stand is open. Bring your horn; real books on hand." },
      { weekday: 0, start: "15:00", end: "18:00", title: "Sunday Kitchen Party", category: "traditional session", genres: ["Celtic", "Folk"], cover: "Free", description: "An all-ages afternoon trad session. Fiddles, guitars, bodhráns, spoons — all welcome." },
    ],
    acts: [
      { name: "Northwest Arm", genres: ["Pop", "Rock"], cover: "$15", blurb: "Halifax indie-pop five-piece with a new single out this month." },
      { name: "Dee Marchand Quartet", genres: ["Jazz"], cover: "$15", blurb: "Modern jazz quartet playing originals and Blue Note-era standards." },
    ],
  },
  {
    key: "rusty-anchor",
    name: "The Rusty Anchor Pub",
    address: "57 Portland Street",
    city: "Dartmouth",
    latitude: 44.6656,
    longitude: -63.5675,
    website: "https://example.com/rusty-anchor",
    kind: "pub",
    weekly: [
      { weekday: 5, start: "21:30", end: "01:00", title: "Friday Karaoke", category: "karaoke night", genres: ["Pop"], cover: "Free", description: "Over 40,000 songs in the book. KJ starts at 9:30 sharp." },
      { weekday: 1, start: "20:00", end: "23:00", title: "Monday Acoustic Night", category: "acoustic open stage", genres: ["Folk", "Country"], cover: "Free", description: "Unplugged open stage. Sign up at the bar." },
    ],
    acts: [
      { name: "Fog Horn Five", genres: ["Rock"], cover: "$8", blurb: "Classic rock covers from the 60s through the 90s." },
    ],
  },
  {
    key: "bedford-basin-grill",
    name: "Bedford Basin Grill",
    address: "1650 Bedford Highway",
    city: "Bedford",
    latitude: 44.7262,
    longitude: -63.6553,
    website: "https://example.com/bedford-basin-grill",
    kind: "restaurant",
    weekly: [
      { weekday: 6, start: "18:00", end: "21:00", title: "Saturday Dinner Jazz", category: "live music", genres: ["Jazz"], description: "Duo jazz standards during dinner service. No cover with a dinner reservation." },
    ],
  },
  {
    key: "orchard-cider-house",
    name: "Orchard Lane Cider House",
    address: "312 Main Street",
    city: "Wolfville",
    latitude: 45.0907,
    longitude: -64.3626,
    website: "https://example.com/orchard-cider",
    kind: "brewery",
    weekly: [
      { weekday: 4, start: "19:00", end: "22:00", title: "Valley Open Mic", category: "open-mic", genres: ["Folk", "Pop"], cover: "Free", description: "Students and locals share the stage. Poetry welcome too." },
    ],
    acts: [
      { name: "Gaspereau Strings", genres: ["Folk", "Celtic"], cover: "$10", blurb: "Valley string band with a foot-stomping live show." },
      { name: "Minas Basin Blues Co.", genres: ["Blues"], cover: "$10", blurb: "Slide guitar, harmonica and a horn section." },
    ],
  },
  {
    key: "dory-lunenburg",
    name: "The Dory Shed",
    address: "88 Montague Street",
    city: "Lunenburg",
    latitude: 44.3758,
    longitude: -64.3112,
    website: "https://example.com/dory-shed",
    kind: "pub",
    weekly: [
      { weekday: 5, start: "20:00", end: "23:00", title: "Friday Sea Shanty Session", category: "singaround session", genres: ["Folk", "Celtic"], cover: "Free", description: "Lead a shanty or join the chorus. Lyric sheets provided." },
    ],
    acts: [{ name: "Ironbound Duo", genres: ["Folk"], cover: "$10", blurb: "Songs of the South Shore, old and new." }],
  },
  {
    key: "mahone-bay-legion",
    name: "Mahone Bay Community Hall",
    address: "45 Edgewater Street",
    city: "Mahone Bay",
    latitude: 44.4471,
    longitude: -64.3797,
    website: "https://example.com/mahone-bay-hall",
    kind: "community",
    weekly: [
      { weekday: 3, start: "19:00", end: "21:30", title: "Old-Time Fiddle Jam", category: "jam", genres: ["Celtic", "Country"], cover: "$2", description: "Monthly-style fiddle jam held weekly. Tea and biscuits at the break.", biweekly: true },
    ],
  },
  {
    key: "hub-truro",
    name: "The Hub Bar & Stage",
    address: "620 Prince Street",
    city: "Truro",
    latitude: 45.3659,
    longitude: -63.2793,
    website: "https://example.com/hub-truro",
    kind: "bar",
    weekly: [
      { weekday: 6, start: "21:00", end: "01:00", title: "Saturday Night Live Band", category: "live band", genres: ["Rock", "Country"], cover: "$10", description: "Rotating regional bands every Saturday." },
      { weekday: 3, start: "20:00", end: "23:30", title: "Hump Day Karaoke", category: "karaoke", genres: ["Pop"], cover: "Free", description: "Wing specials and karaoke all night." },
    ],
  },
  {
    key: "highland-antigonish",
    name: "Highland Crossing Pub",
    address: "201 Main Street",
    city: "Antigonish",
    latitude: 45.6224,
    longitude: -61.9937,
    website: "https://example.com/highland-crossing",
    kind: "pub",
    weekly: [
      { weekday: 2, start: "21:00", end: "00:00", title: "Tuesday Ceilidh Session", category: "trad session", genres: ["Celtic"], cover: "Free", description: "Fiddles and pipes in the back room; step dancers often drop by." },
    ],
    acts: [{ name: "The Keppoch Lads", genres: ["Celtic"], cover: "$12", blurb: "High-energy Celtic rock from the Highlands." }],
  },
  {
    key: "steelworks-sydney",
    name: "Steelworks Social Club",
    address: "315 Charlotte Street",
    city: "Sydney",
    latitude: 46.1371,
    longitude: -60.1955,
    website: "https://example.com/steelworks",
    kind: "venue",
    weekly: [
      { weekday: 4, start: "20:00", end: "23:00", title: "Cape Breton Songwriters' Circle", category: "open mic", genres: ["Folk", "Country"], cover: "$5", description: "Four songwriters in the round, then an open stage for the last hour." },
    ],
    acts: [
      { name: "Glace Bay Grit", genres: ["Rock", "Blues"], cover: "$15", blurb: "Gritty blues-rock power trio." },
      { name: "Port Morien Fiddlers", genres: ["Celtic"], cover: "$10", blurb: "Three generations of Cape Breton fiddling." },
    ],
  },
  {
    key: "ceilidh-loft-baddeck",
    name: "The Ceilidh Loft",
    address: "490 Chebucto Street",
    city: "Baddeck",
    latitude: 46.1006,
    longitude: -60.7518,
    website: "https://example.com/ceilidh-loft",
    kind: "community",
    weekly: [
      { weekday: 1, start: "19:30", end: "21:30", title: "Monday Night Ceilidh", category: "ceilidh concert", genres: ["Celtic"], cover: "$15", description: "Fiddle, piano and step dancing in an intimate loft. Arrive early, seating is limited." },
    ],
  },
  {
    key: "shore-inverness",
    name: "Shoreline Brewing Co.",
    address: "15887 Central Avenue",
    city: "Inverness",
    latitude: 46.2289,
    longitude: -61.3013,
    website: "https://example.com/shoreline-brewing",
    kind: "brewery",
    weekly: [
      { weekday: 6, start: "16:00", end: "19:00", title: "Saturday Afternoon Session", category: "live music", genres: ["Celtic", "Folk"], cover: "Free", description: "Local players on the patio (indoors when the weather turns)." },
    ],
  },
  {
    key: "lighthouse-yarmouth",
    name: "Lighthouse Lounge",
    address: "301 Main Street",
    city: "Yarmouth",
    latitude: 43.8361,
    longitude: -66.1185,
    website: "https://example.com/lighthouse-lounge",
    kind: "bar",
    weekly: [
      { weekday: 5, start: "21:00", end: "00:30", title: "Friday Night Band", category: "live band", genres: ["Country", "Rock"], cover: "$7", description: "Live local bands every Friday." },
      { weekday: 0, start: "19:00", end: "22:00", title: "Sunday Blues Jam", category: "blues jam", genres: ["Blues"], cover: "Free", description: "Backline provided; bring your axe." },
    ],
  },
  {
    key: "fort-annapolis",
    name: "Fort Side Tavern",
    address: "252 St George Street",
    city: "Annapolis Royal",
    latitude: 44.7425,
    longitude: -65.5187,
    website: "https://example.com/fort-side",
    kind: "pub",
    weekly: [
      { weekday: 6, start: "20:00", end: "23:00", title: "Saturday Roots Night", category: "live music", genres: ["Folk", "Country"], cover: "$5", description: "Roots and Americana from Valley musicians." },
    ],
  },
  {
    key: "pictou-new-glasgow",
    name: "Pictou County Music Hall",
    address: "125 Provost Street",
    city: "New Glasgow",
    latitude: 45.5893,
    longitude: -62.6487,
    website: "https://example.com/pc-music-hall",
    kind: "venue",
    weekly: [
      { weekday: 2, start: "19:00", end: "21:00", title: "Beginner-Friendly Jam", category: "jam session", genres: ["Country", "Folk"], cover: "Free", description: "Slow-tempo jam for new players. Chord charts handed out." },
    ],
    acts: [{ name: "East River Band", genres: ["Country"], cover: "$15", blurb: "Award-winning country band from Pictou County." }],
  },
  {
    key: "north-end-cellar",
    name: "North End Cellar",
    address: "2537 Agricola Street",
    city: "Halifax",
    latitude: 44.6608,
    longitude: -63.5952,
    website: "https://example.com/north-end-cellar",
    kind: "bar",
    weekly: [
      { weekday: 5, start: "22:00", end: "02:00", title: "Late Night Indie", category: "concert", genres: ["Rock", "Pop"], cover: "$12", description: "Two or three local indie bands. 19+.", biweekly: true },
      { weekday: 1, start: "21:00", end: "00:00", title: "Industry Night Karaoke", category: "karaoke", genres: ["Pop", "Rock"], cover: "Free", description: "For the folks who work weekends. Drink specials all night." },
    ],
    acts: [{ name: "Quinpool Quartet", genres: ["Jazz", "Pop"], cover: "$15", blurb: "Jazz reworkings of pop hits." }],
  },
];

/** What normalisation needs to know about a venue, whichever registry it's in. */
export interface VenueInfo {
  name: string;
  address?: string;
  city: string;
  website?: string;
  latitude?: number;
  longitude?: number;
}

function registry(): (VenueInfo & { aliases?: string[] })[] {
  return [...NS_VENUES, ...VENUES];
}

export function findVenue(name: string, city?: string): VenueInfo | undefined {
  const n = normaliseVenueName(name);
  if (!n) return undefined;
  const hits = registry().filter((v) => [v.name, ...(v.aliases ?? [])].some((x) => normaliseVenueName(x) === n));
  // A known name in a different town is a different place ("The Local" isn't only in Halifax).
  return city?.trim() ? hits.find((v) => v.city.toLowerCase() === city.trim().toLowerCase()) : hits[0];
}

/** "The Rusty Anchor Pub" → "rusty anchor" */
export function normaliseVenueName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’'`.,!]/g, "")
    .replace(/\b(the|pub|bar|grill|tavern|lounge|co|company|inc|ltd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
