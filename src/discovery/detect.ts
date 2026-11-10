/**
 * Look at one web page and report every machine-readable event source on it,
 * plus links worth following. Pure function: no network.
 */
export interface Detected {
  /** iCalendar feeds: <link type="text/calendar">, .ics links, webcal:, Google Calendar embeds, WordPress "?ical=1". */
  icalUrls: string[];
  /** The page itself carries schema.org Event JSON-LD. */
  hasJsonLdEvents: boolean;
  /** Eventbrite organizer IDs from eventbrite.*\/o/... links. */
  eventbriteOrganizerIds: string[];
  /** Eventbrite event IDs from eventbrite.*\/e/...-tickets-123 links (resolved to organizers via the API). */
  eventbriteEventIds: string[];
  /** Same-site links that look like event/calendar pages. */
  eventPageLinks: string[];
  /** Links to other sites (candidate venue websites), minus social media and ticketing. */
  externalLinks: string[];
}

const EVENTISH = /event|calendar|whats-?on|what-s-on|music|live|schedule|shows|gigs|entertainment|open-?mic|ceilidh|concert/i;
const SKIP_HOSTS = /(^|\.)(facebook|instagram|twitter|x|tiktok|youtube|youtu|linkedin|pinterest|google|goo|apple|spotify|tripadvisor|yelp|opentable|ticketmaster|ticketpro|eventbrite|wikipedia|doubleclick|mailchimp|wordpress|wix|squarespace|bit|linktr|amazon)\.[a-z.]+$/i;
const ASSET = /\.(jpe?g|png|gif|webp|svg|pdf|css|js|zip|mp3|mp4|ico|woff2?)(\?|$)/i;

function decodeAttr(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&quot;/g, '"').trim();
}

export function detectSources(html: string, pageUrl: string): Detected {
  const page = new URL(pageUrl);
  const ical = new Set<string>();
  const ebOrg = new Set<string>();
  const ebEvent = new Set<string>();
  const sameSite = new Set<string>();
  const external = new Set<string>();

  const resolve = (href: string): URL | null => {
    try {
      const h = decodeAttr(href).replace(/^webcal:/i, "https:");
      return new URL(h, page);
    } catch {
      return null;
    }
  };

  // <link rel="alternate" type="text/calendar" href="...">
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (/type=["']text\/calendar["']/i.test(tag)) {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      const u = href && resolve(href);
      if (u) ical.add(u.toString());
    }
  }

  // Google Calendar embeds → public iCal address.
  for (const m of html.matchAll(/calendar\.google\.com\/calendar\/(?:u\/\d+\/)?embed\?([^"'\s>]+)/gi)) {
    const qs = new URLSearchParams(decodeAttr(m[1]));
    for (const src of qs.getAll("src")) {
      if (src) ical.add(`https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`);
    }
  }

  // WordPress + The Events Calendar: its pages carry "tribe-events" markup and export with ?ical=1.
  if (/tribe-events|tribe_events|the-events-calendar/i.test(html)) {
    const base = html.match(/["'](https?:\/\/[^"']+\/events\/)["']/i)?.[1];
    const eventsRoot = base ? new URL(base) : new URL("/events/", page);
    if (eventsRoot.host === page.host) ical.add(new URL("month/{month}/?ical=1", eventsRoot).toString().replace("%7Bmonth%7D", "{month}"));
  }

  const hasJsonLdEvents = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].some(([, json]) =>
    /"@type"\s*:\s*(\[[^\]]*)?"(Music)?Event"/.test(json),
  );

  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    const u = resolve(m[1]);
    if (!u || !/^https?:$/.test(u.protocol)) continue;
    const href = u.toString();
    if (/eventbrite\./i.test(u.host)) {
      const org = u.pathname.match(/\/o\/(?:[^/]*-)?(\d{6,})/);
      if (org) ebOrg.add(org[1]);
      const ev = u.pathname.match(/\/e\/(?:[^/]*-)?(\d{6,})/);
      if (ev) ebEvent.add(ev[1]);
      continue;
    }
    if (/\.ics(\?|$)/i.test(u.pathname) || /[?&]ical=1\b/.test(u.search) || /[?&]outlook-ical=1\b/.test(u.search)) {
      ical.add(href);
      continue;
    }
    if (ASSET.test(u.pathname)) continue;
    if (u.host === page.host) {
      if (EVENTISH.test(u.pathname) && u.pathname !== page.pathname) sameSite.add(`${u.origin}${u.pathname}`);
    } else if (!SKIP_HOSTS.test(u.hostname)) {
      external.add(`${u.origin}/`);
    }
  }

  // Single-event ?ical=1 links (WordPress "add to calendar" on one event) are covered by the
  // site-wide month export; keep the site-wide one when both are present.
  const icalUrls = [...ical];
  const siteWide = icalUrls.filter((u) => u.includes("{month}"));
  const filtered = siteWide.length ? icalUrls.filter((u) => u.includes("{month}") || !/[?&]ical=1/.test(u)) : icalUrls;

  return {
    icalUrls: filtered,
    hasJsonLdEvents,
    eventbriteOrganizerIds: [...ebOrg],
    eventbriteEventIds: [...ebEvent],
    eventPageLinks: [...sameSite],
    externalLinks: [...external],
  };
}
