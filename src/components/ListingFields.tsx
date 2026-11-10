import type { ManualEntry } from "@/pipeline/sources/manual";
import { CATEGORIES, DAYS } from "@/lib/listing-form";

/** The details of a regular night, as plain form inputs (works without JavaScript). */
export default function ListingFields({ entry }: { entry?: Partial<ManualEntry> }) {
  const e = entry ?? {};
  return (
    <div className="form-grid">
      <label className="span-2">
        Event name
        <input name="title" required maxLength={120} defaultValue={e.title} placeholder="e.g. Tuesday Open Mic" />
      </label>
      <label>
        Venue
        <input name="venue" required maxLength={120} defaultValue={e.venue} placeholder="e.g. The Loose Cannon" />
      </label>
      <label>
        Town
        <input name="city" required maxLength={80} defaultValue={e.city} placeholder="e.g. Halifax" />
      </label>
      <label className="span-2">
        <span>
          Street address <span className="muted">(optional)</span>
        </span>
        <input name="address" maxLength={160} defaultValue={e.address} placeholder="e.g. 123 Main Street" />
      </label>
      <fieldset className="span-2 days">
        <legend>Which days?</legend>
        {DAYS.map(([code, label]) => (
          <label key={code} className="day">
            <input type="checkbox" name="weekly" value={code} defaultChecked={e.weekly?.includes(code)} /> {label}
          </label>
        ))}
      </fieldset>
      <label>
        Starts
        <input type="time" name="start" required defaultValue={e.start} />
      </label>
      <label>
        <span>
          Ends <span className="muted">(optional)</span>
        </span>
        <input type="time" name="end" defaultValue={e.end} />
      </label>
      <label className="check span-2">
        <input type="checkbox" name="biweekly" defaultChecked={e.biweekly} /> Every other week only
      </label>
      <fieldset className="span-2 days">
        <legend>Only some weeks of the month? (leave blank for every week)</legend>
        {([[1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [-1, "Last"]] as const).map(([n, label]) => (
          <label key={n} className="day">
            <input type="checkbox" name="monthWeeks" value={n} defaultChecked={e.monthWeeks?.includes(n)} /> {label}
          </label>
        ))}
      </fieldset>
      <label>
        If every other week: date of an upcoming one
        <input type="date" name="from" defaultValue={e.from} />
      </label>
      <label>
        Type
        <select name="category" defaultValue={e.category ?? ""}>
          <option value="">Live music / other</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>
          Cover <span className="muted">(optional)</span>
        </span>
        <input name="cover" maxLength={40} defaultValue={e.cover} placeholder="e.g. Free, $5, PWYC" />
      </label>
      <label>
        <span>
          Link <span className="muted">(optional)</span>
        </span>
        <input name="website" maxLength={300} defaultValue={e.website} placeholder="Venue page about this night" />
      </label>
      <label className="span-2">
        <span>
          Description <span className="muted">(optional)</span>
        </span>
        <textarea name="description" maxLength={600} rows={3} defaultValue={e.description} placeholder="Host, sign-up time, ages…" />
      </label>
    </div>
  );
}
