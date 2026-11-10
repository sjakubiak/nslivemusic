import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { entryFromForm, formFields, FormError } from "@/lib/listing-form";
import { approve, getListing, reject, removeListing, saveListing } from "@/lib/listings";
import { runIngest } from "@/lib/refresh";
import { sameOrigin } from "@/lib/rate-limit";

/** Admin form posts: approve/reject suggestions, or edit/add/remove nights directly. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers) || !(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const f = formFields(await req.formData());
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
  const action = one("action");
  const id = one("id");
  const to = new URL(one("back") === "edit" && id ? `/admin/edit/${encodeURIComponent(id)}` : "/admin", req.url);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax" }).format(new Date());
  try {
    if (action === "approve") {
      const s = await getListing(id);
      const withDetails = s && s.kind !== "remove" && s.kind !== "report";
      await approve(id, withDetails ? entryFromForm(f, s!.entry?.source ?? "Suggested on the site", today) : undefined);
      to.searchParams.set("ok", "Approved. The site updates in about a minute.");
    } else if (action === "reject") {
      await reject(id);
      to.searchParams.set("ok", "Suggestion declined.");
    } else if (action === "save") {
      const existing = id ? await getListing(id) : undefined;
      await saveListing(existing?.id, entryFromForm(f, existing?.entry?.source ?? "Added by the site admin", today));
      to.pathname = "/admin";
      to.searchParams.set("ok", "Saved. The site updates in about a minute.");
    } else if (action === "remove") {
      await removeListing(id);
      to.pathname = "/admin";
      to.searchParams.set("ok", "Removed. The site updates in about a minute.");
    } else {
      throw new FormError("Unknown action.");
    }
  } catch (err) {
    to.searchParams.set("error", err instanceof FormError || err instanceof Error ? err.message : "Something went wrong.");
    return NextResponse.redirect(to, 303);
  }
  if (action !== "reject") void runIngest();
  return NextResponse.redirect(to, 303);
}
