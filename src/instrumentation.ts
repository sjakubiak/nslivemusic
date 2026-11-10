/**
 * Keeps events fresh while the server stays up: re-runs the ingest pipeline
 * every INGEST_INTERVAL_HOURS (default 6). The start command already ingests
 * once at boot; events-store reads data/events.json on each request, so new
 * events show up without a restart. Set INGEST_INTERVAL_HOURS=0 to disable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const hours = Number(process.env.INGEST_INTERVAL_HOURS ?? 6);
  if (!hours) return;
  const { runIngest } = await import("./lib/refresh");
  setInterval(() => void runIngest(), hours * 3600_000).unref();
  console.log(`[refresh] re-ingesting every ${hours}h`);
}
