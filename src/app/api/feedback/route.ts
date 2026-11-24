import { NextResponse, type NextRequest } from "next/server";
import { FeedbackError, feedbackFromForm, saveFeedback } from "@/lib/feedback";
import { allow, clientIp, sameOrigin } from "@/lib/rate-limit";

/** Public form post from /feedback. Stored for the admin; nothing is shown publicly. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return new NextResponse("Forbidden", { status: 403 });
  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const back = (params: Record<string, string>) => {
    const u = new URL("/feedback", req.url);
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    return NextResponse.redirect(u, 303);
  };
  if (get("company")) return back({ sent: "1" }); // honeypot: pretend it worked
  if (!allow(`feedback:${clientIp(req.headers)}`, 6, 3600_000)) {
    return back({ error: "Too many messages from here in the last hour. Please try again later." });
  }
  try {
    await saveFeedback(feedbackFromForm(get));
  } catch (err) {
    if (err instanceof FeedbackError) return back({ error: err.message, from: get("page") });
    console.error("[feedback] failed:", err);
    return back({ error: "Sorry, we couldn't save that just now. Please try again in a few minutes.", from: get("page") });
  }
  return back({ sent: "1" });
}
