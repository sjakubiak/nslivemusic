/**
 * Sites that must never be fetched or linked, even if the auto-finder comes
 * across them. livemusichalifax.ca: reported by Stephen on 2026-11-10 as
 * serving a scam that infected his browser.
 */
export const BLOCKED_HOSTS = ["livemusichalifax.ca", "magic949.ca", "rainbowregistered.ca", "rainbowregistered.com"];

export function isBlocked(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return BLOCKED_HOSTS.some((b) => h === b || h.endsWith(`.${b}`));
  } catch {
    return true;
  }
}
