/**
 * Re-runs the ingest pipeline after the admin approves a change, and every
 * 6 hours on a Node server.
 *
 * - Node server (local, Render): runs `npm run ingest` in a child process; it
 *   writes data/events.json, which every request reads. If a run is already
 *   going, one more is queued so the latest change is never missed.
 * - Cloudflare Workers: there's no disk or child process, so this asks GitHub
 *   to run the "Deploy to Cloudflare" workflow, which ingests and redeploys
 *   (takes a few minutes). Needs GITHUB_DEPLOY_TOKEN; without it the change
 *   shows up at the next 6-hourly rebuild.
 */
type State = { running: boolean; again: boolean };
const g = globalThis as typeof globalThis & { __ingest?: State };
const state: State = (g.__ingest ??= { running: false, again: false });

export function onCloudflare(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export async function runIngest(): Promise<void> {
  if (onCloudflare()) return triggerDeploy();
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  const { spawn } = await import("node:child_process");
  const done = () => {
    state.running = false;
    if (state.again) {
      state.again = false;
      void runIngest();
    }
  };
  const child = spawn("npm", ["run", "ingest", "--silent"], { stdio: "inherit" });
  child.on("exit", done);
  child.on("error", (err) => {
    console.warn(`[refresh] ingest failed to start: ${err.message}`);
    done();
  });
}

async function triggerDeploy(): Promise<void> {
  const token = process.env.GITHUB_DEPLOY_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "sjakubiak/nslivemusic";
  if (!token) {
    console.warn("[refresh] GITHUB_DEPLOY_TOKEN not set; change will show at the next scheduled rebuild");
    return;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/cloudflare.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "nslivemusic-site",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (!res.ok) console.warn(`[refresh] GitHub dispatch failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.warn(`[refresh] GitHub dispatch failed: ${(err as Error).message}`);
  }
}
