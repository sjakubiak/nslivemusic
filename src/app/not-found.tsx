import Link from "next/link";
export default function NotFound() {
  return (
    <main className="details">
      <h1>Event not found</h1>
      <p>It may have already happened or been removed by the venue.</p>
      <Link href="/">← Back to all events</Link>
    </main>
  );
}
