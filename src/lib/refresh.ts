/**
 * Re-runs the ingest pipeline in a child process (it writes data/events.json,
 * which every request reads). Used by the 6-hourly refresh and after the admin
 * approves a change. If a run is already going, one more is queued so the
 * latest change is never missed.
 */
type State = { running: boolean; again: boolean };
const g = globalThis as typeof globalThis & { __ingest?: State };
const state: State = (g.__ingest ??= { running: false, again: false });

export async function runIngest(): Promise<void> {
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
