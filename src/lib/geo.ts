export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/**
 * Towns users can pick as an "entered location" without needing an external
 * geocoding service. Swap for Nominatim / a geocoder later.
 */
export const NS_PLACES: Record<string, LatLng> = {
  Halifax: { lat: 44.6488, lng: -63.5752 },
  Dartmouth: { lat: 44.6713, lng: -63.5772 },
  Bedford: { lat: 44.7325, lng: -63.6559 },
  Wolfville: { lat: 45.0918, lng: -64.3598 },
  Lunenburg: { lat: 44.3769, lng: -64.3093 },
  Truro: { lat: 45.3653, lng: -63.2869 },
  Antigonish: { lat: 45.6169, lng: -61.9986 },
  Sydney: { lat: 46.1368, lng: -60.1942 },
  Yarmouth: { lat: 43.8374, lng: -66.1174 },
  "Annapolis Royal": { lat: 44.7414, lng: -65.5163 },
  "Mahone Bay": { lat: 44.4466, lng: -64.3818 },
  "Baddeck": { lat: 46.1003, lng: -60.7536 },
  "Inverness": { lat: 46.2264, lng: -61.3047 },
  "New Glasgow": { lat: 45.5878, lng: -62.6457 },
};
