import { NextResponse, type NextRequest } from "next/server";
import { entryFromForm, formFields, FormError, noteFromForm } from "@/lib/listing-form";
import { getListing, submitSuggestion, type SuggestionKind } from "@/lib/listings";
import { getEventById } from "@/lib/events-store";
import { allow, clientIp, sameOrigin } from "@/lib/rate-limit";

/** Public form post: stores a suggestion as "pending" for the admin to review. Nothing goes live here. */
export async function POST(req: NextRequest) {
  const back = (params: Record<string, string>) => {
    const u = new URL("/suggest", req.url);
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    return NextResponse.redirect(u, 303);
  };
  if (!sameOrigin(req.headers)) return new NextResponse("Forbidden", { status: 403 });
  const f = formFields(await req.formData());
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
  const ctx = { listing: one("targetId"), event: one("eventId") };
  if (one("company")) return back({ sent: "1" }); // honeypot: pretend it worked
  if (!allow(`suggest:${clientIp(req.headers)}`, 8, 3600_000)) {
    return back({ ...ctx, error: "Too many suggestions from here in the last hour. Please try again later." });
  }

  const kind = one("kind") as SuggestionKind;
  if (!["new", "edit", "remove", "report"].includes(kind)) return back({ ...ctx, error: "Something went wrong, please try again." });
  try {
    const { note, contact } = noteFromForm(f);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax" }).format(new Date());
    if (kind === "edit" || kind === "remove") {
      const target = await getListing(ctx.listing);
      if (!target || target.status !== "live") throw new FormError("That night isn't listed any more.");
      const entry = kind === "edit" ? entryFromForm(f, "Suggested on the site", today) : null;
      await submitSuggestion({ kind, targetId: target.id, entry, note, contact });
    } else if (kind === "report") {
      if (!getEventById(ctx.event)) throw new FormError("That event isn't listed any more.");
      if (!note) throw new FormError("Please say what's wrong.");
      await submitSuggestion({ kind, eventId: ctx.event, note, contact });
    } else {
      await submitSuggestion({ kind, entry: entryFromForm(f, "Suggested on the site", today), note, contact });
    }
  } catch (err) {
    if (err instanceof FormError) return back({ ...ctx, error: err.message });
    console.error("[suggest] failed:", err);
    return back({ ...ctx, error: "Sorry, we couldn't save that just now. Please try again in a few minutes." });
  }
  return back({ sent: "1" });
}
