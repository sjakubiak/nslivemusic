/** All "today / tonight / this weekend" logic is evaluated in Nova Scotia time. */
export const NS_TZ = "America/Halifax";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: NS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day in Halifax as "YYYY-MM-DD". */
export function nsDayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

/** Day of week in Halifax, 0 = Sunday. */
export function nsWeekday(d: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: NS_TZ, weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** Add whole calendar days to a "YYYY-MM-DD" key. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Offset of Halifax from UTC (minutes) at a given instant, e.g. -180 in summer. */
function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: NS_TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Convert a Halifax wall-clock date + "HH:MM" into a UTC Date. */
export function nsLocalToUtc(dayKey: string, hhmm: string): Date {
  const [y, mo, d] = dayKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle DST transitions correctly.
  let utc = guess - offsetMinutes(new Date(guess)) * 60_000;
  utc = guess - offsetMinutes(new Date(utc)) * 60_000;
  return new Date(utc);
}

export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NS_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NS_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatEventRange(start: string, end?: string): string {
  const s = `${formatEventDate(start)} · ${formatEventTime(start)}`;
  return end ? `${s} – ${formatEventTime(end)}` : s;
}
