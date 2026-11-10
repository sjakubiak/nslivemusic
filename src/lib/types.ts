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
  LIVE_MUSIC: "#2563eb", // blue
  OPEN_MIC: "#16a34a", // green
  JAM_SESSION: "#9333ea", // purple
  KARAOKE: "#ea580c", // orange
  OTHER: "#64748b", // slate
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
}
