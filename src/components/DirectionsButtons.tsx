"use client";
import { appleDirectionsUrl, googleDirectionsUrl } from "@/lib/directions";
import type { LatLng } from "@/lib/geo";

/**
 * When `origin` is omitted both apps route from the device's current location.
 * Pass an origin when the user entered a starting place instead.
 */
export default function DirectionsButtons({
  dest,
  origin,
  compact,
}: {
  dest: LatLng;
  origin?: LatLng;
  compact?: boolean;
}) {
  return (
    <div className={`directions ${compact ? "compact" : ""}`}>
      <a className="btn btn-primary" href={googleDirectionsUrl(dest, origin)} target="_blank" rel="noopener noreferrer">
        {compact ? "Directions" : "Google Maps"}
      </a>
      <a className="btn" href={appleDirectionsUrl(dest, origin)} target="_blank" rel="noopener noreferrer">
        Apple Maps
      </a>
    </div>
  );
}
