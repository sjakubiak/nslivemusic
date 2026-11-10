import Link from "next/link";
import type { Metadata } from "next";
import ListingFields from "@/components/ListingFields";
import { getListing } from "@/lib/listings";
import { getEventById } from "@/lib/events-store";
import { formatEventDate, formatEventTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add or update an event | NS Live Music Finder" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SuggestPage({ searchParams }: Props) {
  const p = await searchParams;
  if (p.sent) {
    return (
      <main className="page narrow">
        <h1>Thanks!</h1>
        <p>Your suggestion has been sent. It will appear on the site once it has been checked, usually within a day or two.</p>
        <p>
          <Link href="/">Back to all events</Link> · <Link href="/suggest">Add another night</Link>
        </p>
      </main>
    );
  }

  const listing = p.listing ? await getListing(p.listing) : undefined;
  const live = listing?.status === "live" ? listing : undefined;
  const event = !live && p.event ? getEventById(p.event) : undefined;

  return (
    <main className="page narrow">
      <Link href={p.event ? `/events/${encodeURIComponent(p.event)}` : "/"} className="back">
        ← Back
      </Link>
      {live ? (
        <>
          <h1>Update “{live.entry!.title}”</h1>
          <p className="muted">Fix anything that's wrong below, or tell us it has stopped. Changes go live after a quick check.</p>
        </>
      ) : event ? (
        <>
          <h1>Report a problem</h1>
          <p className="muted">
            “{event.title}” at {event.venueName}, {formatEventDate(event.startDateTime)} {formatEventTime(event.startDateTime)}. This one comes
            from the venue's own calendar, so tell us what's wrong and we'll look into it.
          </p>
        </>
      ) : (
        <>
          <h1>Add a regular night</h1>
          <p className="muted">Know an open mic, jam, session or weekly music night in Nova Scotia? Add it here. It goes live after a quick check.</p>
        </>
      )}

      {p.error && (
        <p className="form-error" role="alert">
          {p.error}
        </p>
      )}

      <form method="post" action="/api/suggest" className="card-form">
        {live && <input type="hidden" name="targetId" value={live.id} />}
        {event && <input type="hidden" name="eventId" value={event.id} />}
        {live && (
          <fieldset className="choice">
            <label>
              <input type="radio" name="kind" value="edit" defaultChecked /> Update the details
            </label>
            <label>
              <input type="radio" name="kind" value="remove" /> This night has stopped running
            </label>
          </fieldset>
        )}
        {!live && <input type="hidden" name="kind" value={event ? "report" : "new"} />}
        {!event && <ListingFields entry={live?.entry ?? undefined} />}

        <label className="block">
          <span>
            {event ? "What's wrong?" : "Anything else we should know?"} {!event && <span className="muted">(optional)</span>}
          </span>
          <textarea name="note" rows={3} maxLength={1000} required={Boolean(event)} placeholder={event ? "e.g. it starts at 9, not 8" : "e.g. I play there most weeks"} />
        </label>
        <label className="block">
          <span>
            Your email or phone <span className="muted">(optional, only seen by the site admin, in case we have a question)</span>
          </span>
          <input name="contact" maxLength={120} autoComplete="email" />
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
