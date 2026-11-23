/** OTHER = non-music events (comedy, markets, workshops…), mostly from Eventbrite. */
export type EventType = "LIVE_MUSIC" | "OPEN_MIC" | "JAM_SESSION" | "KARAOKE" | "OTHER";

export const EVENT_TYPES: EventType[] = ["LIVE_MUSIC", "OPEN_MIC", "JAM_SESSION", "KARAOKE", "OTHER"];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  LIVE_MUSIC: "Live Music",
  OPEN_MIC: "Open Mic",
  JAM_SESSION: "Jam Session",
  KARAOKE: "Karaoke",
  OTHER: "Other Events",
};

/** Marker / badge colours from the spec. */
export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  LIVE_MUSIC: "#b3402a", // brick red
  OPEN_MIC: "#2f6f5e", // sea green
  JAM_SESSION: "#6d4a86", // heather
  KARAOKE: "#b07a12", // mustard
  OTHER: "#6b6359", // driftwood grey
};

export const GENRES = ["Rock", "Country", "Folk", "Celtic", "Blues", "Jazz", "Pop"] as const;

/**
 * The spec's Event model. Dates are ISO-8601 strings (UTC) once serialised to
 * JSON, so the stored/transferred shape uses strings; parse with `new Date()`.
 */
export interface MusicEvent {
  id: string;
  title: string;
  venueName: string;
  address: string;
  city: string;
  province: "NS";
  latitude: number;
  longitude: number;
  startDateTime: string;
  endDateTime?: string;
  description: string;
  eventType: EventType;
  genre?: string[];
  coverCharge?: number;
  website?: string;
  ticketUrl?: string;
  imageUrl?: string;
  sourceUrl: string;
  verified: boolean;
  lastUpdated: string;
  /** Hand-entered regular nights: the listing behind it, for "suggest a change". */
  listingId?: string;
}
