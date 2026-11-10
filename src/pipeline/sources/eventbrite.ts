import type { Source } from "../types";

/**
 * Eventbrite: use the official API only (https://www.eventbrite.com/platform/api),
 * never HTML scraping, which their terms prohibit. Eventbrite removed its public
 * event-search endpoint, so this connector is meant to read events for
 * organisations/venues that have authorised us (organizer IDs below).
 *
 * Facebook Events: Meta's Graph API only exposes events for Pages that grant
 * the app access; scraping facebook.com is against their terms. Implement a
 * similar connector per partnered venue Page if/when access is approved.
 */
const ORGANIZER_IDS = (process.env.EVENTBRITE_ORGANIZER_IDS ?? "").split(",").filter(Boolean);

export const eventbriteSource: Source = {
  id: "eventbrite",
  name: "Eventbrite (official API)",
  kind: "listing-site",
  termsNote: "Official API with a private token; organizer-scoped.",
  enabled: () => Boolean(process.env.EVENTBRITE_TOKEN) && ORGANIZER_IDS.length > 0,
  async fetch() {
    // TODO: GET https://www.eventbriteapi.com/v3/organizers/{id}/events/?status=live&expand=venue
    //       with Authorization: Bearer $EVENTBRITE_TOKEN, map each event + venue to RawEvent.
    throw new Error("Eventbrite connector not implemented yet");
  },
};
