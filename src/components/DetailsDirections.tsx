"use client";
import { useState } from "react";
import { NS_PLACES } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import DirectionsButtons from "./DirectionsButtons";

/** Directions from current location (default) or an entered starting town. */
export default function DetailsDirections({ dest }: { dest: LatLng }) {
  const [from, setFrom] = useState("");
  return (
    <div className="details-directions">
      <label>
        <span>Starting from</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">My current location</option>
          {Object.keys(NS_PLACES).sort().map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <DirectionsButtons dest={dest} origin={from ? NS_PLACES[from] : undefined} />
    </div>
  );
}
