import type { LatLng } from "./geo";

/** https://developers.google.com/maps/documentation/urls/get-started#directions-action */
export function googleDirectionsUrl(dest: LatLng, origin?: LatLng): string {
  const p = new URLSearchParams({ api: "1", destination: `${dest.lat},${dest.lng}`, travelmode: "driving" });
  if (origin) p.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

/** Apple Maps URL scheme; without saddr Apple Maps uses the current location. */
export function appleDirectionsUrl(dest: LatLng, origin?: LatLng): string {
  const p = new URLSearchParams({ daddr: `${dest.lat},${dest.lng}`, dirflg: "d" });
  if (origin) p.set("saddr", `${origin.lat},${origin.lng}`);
  return `https://maps.apple.com/?${p.toString()}`;
}
