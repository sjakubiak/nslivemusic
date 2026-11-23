import type { MetadataRoute } from "next";
import { getAllEvents, isSampleData } from "@/lib/events-store";
import { SITE_URL, townsWithEvents, upcoming, venuesWithEvents } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Home, the add-a-night form, and every town, venue and event with something coming up. */
export default function sitemap(): MetadataRoute.Sitemap {
  const all = getAllEvents();
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/suggest`, changeFrequency: "monthly", priority: 0.3 },
  ];
  // Made-up sample events aren't worth sending to search engines.
  if (isSampleData()) return base;

  return [
    ...base,
    ...townsWithEvents(all, now).map((t) => ({
      url: `${SITE_URL}/live-music/${t.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...venuesWithEvents(all, now).map((v) => ({
      url: `${SITE_URL}/venues/${v.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...upcoming(all, now).map((e) => ({
      url: `${SITE_URL}/events/${e.id}`,
      lastModified: new Date(e.lastUpdated),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
