import { NextResponse } from "next/server";
import { liveListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

/**
 * GET /api/listings: the approved regular nights (already public on the site).
 * The 6-hourly rebuild in GitHub Actions reads this, since the database lives
 * on Cloudflare. Never includes pending suggestions, notes or contact details.
 */
export async function GET() {
  const listings = (await liveListings()).map((l) => ({
    id: l.id, kind: l.kind, status: l.status, entry: l.entry, createdAt: l.createdAt, reviewedAt: l.reviewedAt ?? null,
  }));
  return NextResponse.json({ listings }, { headers: { "Cache-Control": "no-store" } });
}
