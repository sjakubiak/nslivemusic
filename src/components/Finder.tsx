"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { EventType, MusicEvent } from "@/lib/types";
import { EVENT_TYPES, EVENT_TYPE_COLOR, EVENT_TYPE_LABEL, GENRES } from "@/lib/types";
import { queryEvents, type DateFilter, type SortKey } from "@/lib/filters";
import { NS_PLACES, type LatLng } from "@/lib/geo";
import EventCard from "./EventCard";

const EventMap = dynamic(() => import("./EventMap"), { ssr: false, loading: () => <div className="map map-loading">Loading map…</div> });

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "ALL", label: "Any date" },
  { value: "TODAY", label: "Today" },
  { value: "TOMORROW", label: "Tomorrow" },
  { value: "WEEKEND", label: "This weekend" },
  { value: "NEXT_7", label: "Next 7 days" },
  { value: "CUSTOM", label: "Custom range" },
];
const RADII = [10, 25, 50, 100];

type LocationMode = { kind: "none" } | { kind: "device"; loc: LatLng } | { kind: "place"; name: string; loc: LatLng };

export default function Finder({ events }: { events: MusicEvent[] }) {
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<EventType[]>([]);
  const [date, setDate] = useState<DateFilter>("NEXT_7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [genre, setGenre] = useState("All");
  const [radius, setRadius] = useState<number | "">("");
  const [sort, setSort] = useState<SortKey>("SOONEST");
  const [location, setLocation] = useState<LocationMode>({ kind: "none" });
  const [view, setView] = useState<"list" | "map">("list");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [locError, setLocError] = useState("");

  // Keep "today"/"tonight" accurate if the tab stays open.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const origin = location.kind === "none" ? undefined : location.loc;
  // Device location: let Google/Apple Maps use live GPS. Entered place: pass it as origin.
  const directionsOrigin = location.kind === "place" ? location.loc : undefined;

  const results = useMemo(
    () =>
      queryEvents(
        events,
        { search, types, date, from, to, genre, radiusKm: radius || undefined, origin, sort },
        now,
      ),
    [events, search, types, date, from, to, genre, radius, origin, sort, now],
  );

  function useMyLocation() {
    setLocError("");
    if (!navigator.geolocation) return setLocError("Location isn't available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ kind: "device", loc: { lat: p.coords.latitude, lng: p.coords.longitude } });
        setSort("CLOSEST");
      },
      () => setLocError("Couldn't get your location. Pick a town instead."),
      { timeout: 10_000 },
    );
  }

  function toggleType(t: EventType) {
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  const activeFilters =
    types.length + (date !== "NEXT_7" ? 1 : 0) + (genre !== "All" ? 1 : 0) + (radius ? 1 : 0) + (search ? 1 : 0);

  return (
    <main className="finder">
      <section className="controls" aria-label="Search and filters">
        <div className="search-row">
          <input
            type="search"
            className="search"
            placeholder="Search venue, city, event, genre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search events"
          />
          <div className="view-toggle" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")}>List</button>
            <button role="tab" aria-selected={view === "map"} onClick={() => setView("map")}>Map</button>
          </div>
        </div>

        <div className="chips" role="group" aria-label="Event type">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              className="chip"
              aria-pressed={types.includes(t)}
              style={{ ["--type-color" as string]: EVENT_TYPE_COLOR[t] }}
              onClick={() => toggleType(t)}
            >
              <span className="dot" aria-hidden />
              {EVENT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <label>
            <span>When</span>
            <select value={date} onChange={(e) => setDate(e.target.value as DateFilter)}>
              {DATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {date === "CUSTOM" && (
            <>
              <label>
                <span>From</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}
          <label>
            <span>Genre</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="All">All</option>
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Near</span>
            <select
              value={location.kind === "place" ? location.name : location.kind === "device" ? "__device" : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__device") return useMyLocation();
                if (!v) return setLocation({ kind: "none" });
                setLocation({ kind: "place", name: v, loc: NS_PLACES[v] });
                setSort("CLOSEST");
              }}
            >
              <option value="">Anywhere in NS</option>
              <option value="__device">📍 My current location</option>
              {Object.keys(NS_PLACES).sort().map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Within</span>
            <select
              value={radius}
              disabled={!origin}
              title={origin ? undefined : "Choose a location first"}
              onChange={(e) => setRadius(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Any distance</option>
              {RADII.map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="SOONEST">Soonest first</option>
              <option value="CLOSEST" disabled={!origin}>Closest first</option>
              <option value="ALPHA">Alphabetical</option>
            </select>
          </label>
        </div>
        {locError && <p className="error" role="alert">{locError}</p>}
      </section>

      <div className="results-bar">
        <span aria-live="polite">
          <strong>{results.length}</strong> event{results.length === 1 ? "" : "s"}
          {location.kind === "place" && ` near ${location.name}`}
          {location.kind === "device" && " near you"}
        </span>
        {activeFilters > 0 && (
          <button
            className="link-btn"
            onClick={() => {
              setSearch("");
              setTypes([]);
              setDate("NEXT_7");
              setGenre("All");
              setRadius("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="layout" data-view={view}>
        <section className="list-pane" aria-label="Event list">
          {results.length === 0 ? (
            <div className="empty">
              <p>No events match those filters.</p>
              <p className="muted">Try a wider date range or distance.</p>
            </div>
          ) : (
            <div className="cards">
              {results.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  directionsOrigin={directionsOrigin}
                  highlighted={hoverId === e.id}
                  onHover={setHoverId}
                />
              ))}
            </div>
          )}
        </section>
        <section className="map-pane" aria-label="Event map">
          <EventMap
            events={results}
            userLocation={origin}
            directionsOrigin={directionsOrigin}
            highlightId={hoverId}
            onLocate={(loc) => {
              setLocation({ kind: "device", loc });
              setSort("CLOSEST");
            }}
          />
          <ul className="legend" aria-label="Legend">
            {EVENT_TYPES.map((t) => (
              <li key={t} style={{ ["--type-color" as string]: EVENT_TYPE_COLOR[t] }}>
                <span className="dot" aria-hidden />
                {EVENT_TYPE_LABEL[t]}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
