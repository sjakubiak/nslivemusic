/**
 * Turns the suggest/admin form into a ManualEntry, rejecting anything that
 * doesn't look like a real regular night. Everything here is user input:
 * lengths are capped, links must be plain http(s) and not on the blocklist.
 */
import type { ManualEntry } from "../pipeline/sources/manual";
import { isBlocked } from "../pipeline/blocklist";

export const DAYS = [
  ["MO", "Mon"], ["TU", "Tue"], ["WE", "Wed"], ["TH", "Thu"], ["FR", "Fri"], ["SA", "Sat"], ["SU", "Sun"],
] as const;

export const CATEGORIES = ["open mic", "jam", "session", "kitchen party", "ceilidh", "songwriters circle", "live music", "karaoke"] as const;

type Fields = Record<string, string | string[] | undefined>;

export function formFields(form: FormData): Fields {
  const out: Fields = {};
  for (const key of new Set(form.keys())) {
    const all = form.getAll(key).map(String);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function text(f: Fields, key: string, max: number, required = false): string | undefined {
  const v = one(f[key]).replace(/\s+/g, " ");
  if (!v) {
    if (required) throw new FormError(`Please fill in ${LABELS[key] ?? key}.`);
    return undefined;
  }
  if (v.length > max) throw new FormError(`${LABELS[key] ?? key} is too long (max ${max} characters).`);
  return v;
}

const LABELS: Record<string, string> = {
  title: "the event name", venue: "the venue", city: "the town", address: "the address", start: "the start time",
  end: "the end time", cover: "the cover", description: "the description", website: "the link", note: "the note", contact: "your contact",
};

export class FormError extends Error {}

export function cleanUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new FormError("That link doesn't look like a web address.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new FormError("Links must start with http:// or https://.");
  if (isBlocked(u.href)) throw new FormError("Links to that site aren't allowed.");
  return u.href;
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function entryFromForm(f: Fields, source: string, today: string): ManualEntry {
  const weekly = many(f.weekly).filter((d) => DAYS.some(([code]) => code === d));
  if (!weekly.length) throw new FormError("Pick at least one day of the week.");
  const start = one(f.start);
  if (!TIME.test(start)) throw new FormError("Please give a start time.");
  const end = one(f.end);
  if (end && !TIME.test(end)) throw new FormError("The end time doesn't look right.");
  const biweekly = one(f.biweekly) === "on";
  const from = one(f.from);
  if (biweekly && !DATE.test(from)) throw new FormError("For every-other-week nights, give the date of one upcoming night.");
  const category = one(f.category);

  const entry: ManualEntry = {
    title: text(f, "title", 120, true)!,
    venue: text(f, "venue", 120, true)!,
    address: text(f, "address", 160),
    city: text(f, "city", 80, true)!,
    weekly,
    start: start.padStart(5, "0"),
    end: end ? end.padStart(5, "0") : undefined,
    category: (CATEGORIES as readonly string[]).includes(category) ? category : undefined,
    cover: text(f, "cover", 40),
    description: text(f, "description", 600),
    website: cleanUrl(text(f, "website", 300)),
    source,
    confirmedOn: today,
  };
  if (biweekly) Object.assign(entry, { biweekly: true, from });
  const monthWeeks = many(f.monthWeeks).map(Number).filter((n) => [1, 2, 3, 4, -1].includes(n));
  if (monthWeeks.length) entry.monthWeeks = monthWeeks;
  // Drop empty optionals so stored rows stay tidy.
  for (const k of Object.keys(entry) as (keyof ManualEntry)[]) if (entry[k] === undefined) delete entry[k];
  return entry;
}

export function noteFromForm(f: Fields): { note?: string; contact?: string } {
  return { note: text(f, "note", 1000), contact: text(f, "contact", 120) };
}
