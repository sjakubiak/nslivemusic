import Link from "next/link";
import type { Metadata } from "next";
import { FOUND_VIA, TOPICS } from "@/lib/feedback";
import { CONTACT_EMAIL, pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  ...pageMeta({
    title: "Send feedback",
    description: "Tell us what you'd like to see on NS Live Music Finder: missing venues, ideas, or things that aren't working.",
    path: "/feedback",
  }),
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function FeedbackPage({ searchParams }: Props) {
  const p = await searchParams;
  if (p.sent) {
    return (
      <main className="page narrow">
        <h1>Thanks!</h1>
        <p>Your message has been sent. Every one gets read.</p>
        <p>
          <Link href="/">Back to all events</Link>
        </p>
      </main>
    );
  }
  const from = p.from && p.from.startsWith("/") && !p.from.startsWith("//") ? p.from : "";

  return (
    <main className="page narrow">
      <Link href={from || "/"} className="back">
        ← Back
      </Link>
      <h1>Send feedback</h1>
      <p className="muted">
        This site is run by one person in Nova Scotia. Tell us what's useful, what's missing, or what's broken. To add a regular night,{" "}
        <Link href="/suggest">use this form instead</Link>. You can also email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      {p.error && (
        <p className="form-error" role="alert">
          {p.error}
        </p>
      )}
      <form method="post" action="/api/feedback" className="card-form">
        <input type="hidden" name="page" value={from} />
        <label className="block">
          What's it about?
          <select name="topic" defaultValue="idea">
            {TOPICS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Your message
          <textarea name="message" rows={5} maxLength={2000} required placeholder="e.g. It would be great to see shows in Wolfville too" />
        </label>
        <label className="block">
          <span>
            How did you find this site? <span className="muted">(optional)</span>
          </span>
          <select name="foundVia" defaultValue="">
            <option value="">Prefer not to say</option>
            {FOUND_VIA.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span>
            Where in Nova Scotia are you? <span className="muted">(optional)</span>
          </span>
          <input name="town" maxLength={80} placeholder="e.g. Dartmouth" />
        </label>
        <label className="block">
          <span>
            Your email <span className="muted">(optional, only seen by the site admin)</span>
          </span>
          <input name="contact" type="email" maxLength={120} autoComplete="email" />
        </label>
        <label className="check">
          <input type="checkbox" name="mayContact" /> You can email me about new features or to ask what I think
        </label>
        {/* Spam trap: hidden from people, bots fill it in. */}
        <div className="hp" aria-hidden="true">
          <label>
            Company <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button type="submit" className="primary">
          Send
        </button>
      </form>
    </main>
  );
}
