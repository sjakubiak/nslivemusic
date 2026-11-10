import { NextResponse, type NextRequest } from "next/server";
import { getAllEvents } from "@/lib/events-store";
import { queryEvents, type DateFilter, type SortKey } from "@/lib/filters";
import type { EventType } from "@/lib/types";

/**
 * GET /api/events?q=celtic&type=OPEN_MIC,JAM_SESSION&date=WEEKEND&genre=Folk
 *                &lat=44.65&lng=-63.57&radius=25&sort=CLOSEST&from=&to=
 */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const events = queryEvents(getAllEvents(), {
    search: p.get("q") ?? undefined,
    types: (p.get("type")?.split(",").filter(Boolean) as EventType[]) ?? undefined,
    date: (p.get("date") as DateFilter) ?? "ALL",
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    genre: p.get("genre") ?? undefined,
    radiusKm: p.get("radius") ? Number(p.get("radius")) : undefined,
    origin: Number.isFinite(lat) && Number.isFinite(lng) && p.get("lat") ? { lat, lng } : undefined,
    sort: (p.get("sort") as SortKey) ?? "SOONEST",
  });
  return NextResponse.json({ count: events.length, events });
}
