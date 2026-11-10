import { getWithFetchedChain, isMissingChainError } from "./tls-chain";
/**
 * Fetch helper every web scraper must use. It:
 *   - identifies the bot with a descriptive User-Agent,
 *   - honours robots.txt (Disallow rules for our UA and "*"),
 *   - rate-limits to one request per host every MIN_INTERVAL_MS.
 *
 * robots.txt is necessary but not sufficient: each Source also documents in
 * `termsNote` that the site's terms of service permit collection. Facebook
 * and Eventbrite must go through their official APIs, never HTML scraping.
 */
const USER_AGENT = process.env.SCRAPER_USER_AGENT ?? "NSLiveMusicFinderBot/1.0 (+https://example.com/bot)";
const MIN_INTERVAL_MS = 5_000;

const robotsCache = new Map<string, string[]>();
const lastHit = new Map<string, number>();

export function parseRobots(txt: string, ua = "NSLiveMusicFinderBot"): string[] {
  const disallow: string[] = [];
  let applies = false;
  let sawRule = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...rest] = line.split(":");
    const v = rest.join(":").trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (key === "user-agent") {
      if (sawRule) {
        applies = false;
        sawRule = false;
      }
      if (v === "*" || ua.toLowerCase().includes(v.toLowerCase())) applies = true;
    } else {
      sawRule = true;
      if (applies && key === "disallow" && v) disallow.push(v);
    }
  }
  return disallow;
}

export async function isAllowed(url: string): Promise<boolean> {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    try {
      const res = await getText(`${u.origin}/robots.txt`);
      robotsCache.set(u.origin, res.status >= 200 && res.status < 300 ? parseRobots(res.body) : []);
    } catch {
      robotsCache.set(u.origin, []);
    }
  }
  return !robotsCache.get(u.origin)!.some((p) => u.pathname.startsWith(p));
}

/** fetch(), plus a browser-style retry for sites that omit their intermediate certificate. */
async function getText(url: string): Promise<{ status: number; body: string }> {
  const headers = { "User-Agent": USER_AGENT, Accept: "text/html,application/json,text/calendar;q=0.9,*/*;q=0.5" };
  try {
    const res = await fetch(url, { headers });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    if (isMissingChainError(err)) return getWithFetchedChain(url, headers);
    // Node's "fetch failed" hides the real reason (DNS, TLS certificate chain, reset…).
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(`fetch failed: ${cause?.code ?? ""} ${cause?.message ?? (err as Error).message}`.trim());
  }
}

export async function politeFetch(url: string): Promise<string> {
  if (!(await isAllowed(url))) throw new Error(`robots.txt disallows ${url}`);
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  const res = await getText(url);
  if (res.status < 200 || res.status >= 300) throw new Error(`${res.status} fetching ${url}`);
  return res.body;
}
