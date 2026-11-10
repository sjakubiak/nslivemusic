import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import ListingFields from "@/components/ListingFields";
import { isAdmin } from "@/lib/admin-auth";
import { getListing } from "@/lib/listings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit night | NS Live Music Finder", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function EditListingPage({ params, searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const p = await searchParams;
  const isNew = id === "new";
  const listing = isNew ? undefined : await getListing(id);
  if (!isNew && (!listing || listing.status !== "live")) notFound();

  return (
    <main className="page narrow">
      <Link href="/admin" className="back">← Admin</Link>
      <h1>{isNew ? "Add a night" : `Edit “${listing!.entry!.title}”`}</h1>
      {p.error && <p className="form-error" role="alert">{p.error}</p>}
      <form method="post" action="/api/admin/action" className="card-form">
        {!isNew && <input type="hidden" name="id" value={listing!.id} />}
        <input type="hidden" name="back" value="edit" />
        <ListingFields entry={listing?.entry ?? undefined} />
        <div className="actions">
          <button type="submit" name="action" value="save" className="primary">Save</button>
          {!isNew && (
            <button type="submit" name="action" value="remove" formNoValidate className="danger">
              Remove this night
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
