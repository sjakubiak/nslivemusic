"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { EventWithDistance } from "@/lib/filters";
import { EVENT_TYPE_COLOR, EVENT_TYPE_LABEL } from "@/lib/types";
import { formatEventRange } from "@/lib/time";
import { googleDirectionsUrl } from "@/lib/directions";
import type { LatLng } from "@/lib/geo";

const NS_CENTER: L.LatLngExpression = [45.1, -63.0];

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function markerIcon(color: string, highlighted = false) {
  const size = highlighted ? 30 : 22;
  return L.divIcon({
    className: "event-marker",
    html: `<span style="background:${color};width:${size}px;height:${size}px" class="${highlighted ? "hl" : ""}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function popupHtml(e: EventWithDistance, origin?: LatLng) {
  const color = EVENT_TYPE_COLOR[e.eventType];
  return `<div class="popup">
    <span class="type-pill" style="--type-color:${color}">${EVENT_TYPE_LABEL[e.eventType]}</span>
    <strong class="popup-title">${esc(e.title)}</strong>
    <div>${esc(e.venueName)} · ${esc(e.city)}</div>
    <div>${esc(formatEventRange(e.startDateTime, e.endDateTime))}</div>
    ${e.genre?.length ? `<div class="popup-genre">${esc(e.genre.join(" · "))}</div>` : ""}
    <div class="popup-actions">
      <a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${googleDirectionsUrl({ lat: e.latitude, lng: e.longitude }, origin)}">Directions</a>
      <a class="btn" href="/events/${e.id}">Event details</a>
    </div>
  </div>`;
}

export interface EventMapProps {
  events: EventWithDistance[];
  userLocation?: LatLng;
  directionsOrigin?: LatLng;
  highlightId?: string | null;
  onLocate?: (loc: LatLng) => void;
  /** Single-venue mode for the details page. */
  compact?: boolean;
}

export default function EventMap({ events, userLocation, directionsOrigin, highlightId, onLocate, compact }: EventMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const userMarker = useRef<L.CircleMarker | null>(null);
  const refit = useRef<() => void>(() => {});
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: !compact }).setView(NS_CENTER, 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);

    if (!compact) {
      const Locate = L.Control.extend({
        onAdd() {
          const b = L.DomUtil.create("button", "locate-btn");
          b.type = "button";
          b.title = "My location";
          b.setAttribute("aria-label", "My location");
          b.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
          L.DomEvent.disableClickPropagation(b);
          b.onclick = () =>
            navigator.geolocation?.getCurrentPosition(
              (p) => {
                const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
                onLocateRef.current?.(loc);
                m.flyTo([loc.lat, loc.lng], 12);
              },
              () => alert("Couldn't get your location. Check your browser's location permission."),
            );
          return b;
        },
      });
      new Locate({ position: "topleft" }).addTo(m);
    }

    cluster.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      iconCreateFunction: (c) =>
        L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: "cluster-icon", iconSize: [38, 38] }),
    });
    m.addLayer(cluster.current);
    map.current = m;

    // The map may be created while hidden (mobile list view); refit once it gets a size.
    let wasHidden = el.current.clientWidth === 0;
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      const hidden = el.current?.clientWidth === 0;
      if (wasHidden && !hidden) refit.current();
      wasHidden = hidden;
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, [compact]);

  // Sync markers with the filtered events.
  useEffect(() => {
    const c = cluster.current;
    const m = map.current;
    if (!c || !m) return;
    c.clearLayers();
    markers.current.clear();
    for (const e of events) {
      const mk = L.marker([e.latitude, e.longitude], { icon: markerIcon(EVENT_TYPE_COLOR[e.eventType]), title: e.title });
      mk.bindPopup(popupHtml(e, directionsOrigin), { maxWidth: 260 });
      markers.current.set(e.id, mk);
      c.addLayer(mk);
    }
    refit.current = () => {
      if (compact && events[0]) m.setView([events[0].latitude, events[0].longitude], 14);
      else if (events.length) m.fitBounds(L.latLngBounds(events.map((e) => [e.latitude, e.longitude])).pad(0.15), { maxZoom: 13 });
    };
    if (el.current?.clientWidth) refit.current();
  }, [events, directionsOrigin, compact]);

  // Highlight the marker for the hovered card.
  useEffect(() => {
    markers.current.forEach((mk, id) => {
      const e = events.find((x) => x.id === id);
      if (e) mk.setIcon(markerIcon(EVENT_TYPE_COLOR[e.eventType], id === highlightId));
      mk.setZIndexOffset(id === highlightId ? 1000 : 0);
    });
  }, [highlightId, events]);

  // "You are here" dot.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    userMarker.current?.remove();
    if (userLocation)
      userMarker.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#0ea5e9",
        fillOpacity: 1,
      })
        .bindTooltip("You are here")
        .addTo(m);
  }, [userLocation]);

  return <div ref={el} className={compact ? "map map-compact" : "map"} role="region" aria-label="Event map" />;
}
