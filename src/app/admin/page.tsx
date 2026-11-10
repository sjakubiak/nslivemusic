import Link from "next/link";
import type { Metadata } from "next";
import ListingFields from "@/components/ListingFields";
import { isAdmin } from "@/lib/admin-auth";
import { allListings, storageIsPermanent, type Listing } from "@/lib/listings";
import { getEventById } from "@/lib/events-store";
import { DAYS } from "@/lib/listing-form";
import type { ManualEntry } from "@/pipeline/sources/manual";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin | NS Live Music Finder", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const KIND_LABEL = { new: "New night", edit: "Change", remove: "Says it has stopped", report: "Problem report" } as const;

function when(e: Pick<ManualEntry, "weekly" | "start" | "end" | "biweekly" | "monthWeeks">): string {
  const days = (e.weekly ?? []).map((d) => DAYS.find(([c]) => c === d)?.[1] ?? d).join(", ");
  const nth = e.monthWeeks?.length ? `${e.monthWeeks.map((w) => (w === -1 ? "last" : ["", "1st", "2nd", "3rd", "4th"][w])).join(" & ")} ` : "";
  return `${e.biweekly ? "Every other " : nth ? `The ${nth}` : "Every "}${days} · ${e.start}${e.end ? `–${e.end}` : ""}`;
}

const FIELDS: [keyof ManualEntry, string][] = [
  ["title", "Name"], ["venue", "Venue"], ["address", "Address"], ["city", "Town"], ["weekly", "Days"], ["start", "Starts"], ["end", "Ends"],
  ["biweekly", "Every other week"], ["monthWeeks", "Weeks of month"], ["from", "Upcoming date"], ["category", "Type"], ["cover", "Cover"], ["website", "Link"], ["description", "Description"],
];

function changes(before: ManualEntry | null | undefined, after: ManualEntry | null | undefined) {
  if (!before || !after) return [];
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v));
  return FIELDS.filter(([k]) => show(before[k]) !== show(after[k])).map(([k, label]) => ({ label, from: show(before[k]), to: show(after[k]) }));
}

export default async function AdminPage({ searchParams }: Props) {
  const p = await searchParams;
  if (!(await isAdmin())) {
    return (
      <main className="page narrow">
        <h1>Admin sign in</h1>
        {p.error && <p className="form-error">{p.error}</p>}
        <form method="post" action="/api/admin/login" className="card-form">
          <label className="block">
            Password
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="primary">Sign in</button>
        </form>
      </main>
    );
  }

  let all: Listing[] = [];
  let loadError = "";
  try {
    all = await allListings();
  } catch (err) {
    loadError = (err as Error).message;
  }
  const byId = new Map(all.map((l) => [l.id, l]));
  const pending = all.filter((l) => l.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const live = all
    .filter((l) => l.status === "live" && l.entry)
    .sort((a, b) => (a.entry!.city + a.entry!.venue).localeCompare(b.entry!.city + b.entry!.venue));

  return (
    <main className="page">
      <div className="admin-head">
        <h1>Admin</h1>
        <form method="post" action="/api/admin/logout">
          <button type="submit" className="link-btn">Sign out</button>
        </form>
      </div>
      {!storageIsPermanent() && (
        <p className="form-error">The database isn't connected (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY), so changes here will be lost on the next deploy.</p>
      )}
      {loadError && <p className="form-error">Couldn't load listings: {loadError}</p>}
      {p.ok && <p className="form-ok" role="status">{p.ok}</p>}
      {p.error && <p className="form-error" role="alert">{p.error}</p>}

      <h2>Waiting for review ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">Nothing to review.</p>}
      {pending.map((s) => {
        const target = s.targetId ? byId.get(s.targetId) : undefined;
        const event = s.eventId ? getEventById(s.eventId) : undefined;
        const diff = s.kind === "edit" ? changes(target?.entry, s.entry) : [];
        return (
          <section key={s.id} className="review">
            <header>
              <strong>{KIND_LABEL[s.kind]}</strong>
              <span className="muted"> · sent {new Date(s.createdAt).toLocaleString("en-CA", { timeZone: "America/Halifax" })}</span>
            </header>
            {target?.entry && (
              <p>
                About: <strong>{target.entry.title}</strong> at {target.entry.venue}, {target.entry.city} ({when(target.entry)})
              </p>
            )}
            {s.kind === "report" && (
              <p>
                About: {event ? <Link href={`/events/${event.id}`}>{event.title} at {event.venueName}</Link> : "an event that's no longer listed"}. Fix it at the source (the venue's
                calendar or Eventbrite) or add a manual night, then mark this done.
              </p>
            )}
            {diff.length > 0 && (
              <table className="diff">
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.label}>
                      <th>{d.label}</th>
                      <td className="from">{d.from}</td>
                      <td className="to">{d.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.kind === "edit" && diff.length === 0 && <p className="muted">No details changed.</p>}
            {s.note && <blockquote>{s.note}</blockquote>}
            {s.contact && <p className="muted small">Contact: {s.contact}</p>}
            <form method="post" action="/api/admin/action" className="card-form">
              <input type="hidden" name="id" value={s.id} />
              {(s.kind === "new" || s.kind === "edit") && (
                <details open={s.kind === "new"}>
                  <summary>Check or tidy the details before approving</summary>
                  <ListingFields entry={s.entry ?? undefined} />
                </details>
              )}
              <div className="actions">
                <button type="submit" name="action" value="approve" className="primary">
                  {s.kind === "remove" ? "Approve: take it down" : s.kind === "report" ? "Mark done" : "Approve"}
                </button>
                <button type="submit" name="action" value="reject" formNoValidate>
                  Decline
                </button>
              </div>
            </form>
          </section>
        );
      })}

      <div className="admin-head">
        <h2>Regular nights ({live.length})</h2>
        <Link href="/admin/edit/new" className="primary button">+ Add a night</Link>
      </div>
      <table className="listings">
        <thead>
          <tr><th>Night</th><th>Venue</th><th>When</th><th>Checked</th><th /></tr>
        </thead>
        <tbody>
          {live.map((l) => (
            <tr key={l.id}>
              <td>{l.entry!.title}</td>
              <td>{l.entry!.venue}, {l.entry!.city}</td>
              <td>{when(l.entry!)}</td>
              <td>{l.entry!.confirmedOn}</td>
              <td><Link href={`/admin/edit/${encodeURIComponent(l.id)}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
