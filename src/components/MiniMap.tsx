"use client";
import dynamic from "next/dynamic";
import type { MusicEvent } from "@/lib/types";

const EventMap = dynamic(() => import("./EventMap"), { ssr: false, loading: () => <div className="map map-compact map-loading" /> });

export default function MiniMap({ event }: { event: MusicEvent }) {
  return <EventMap events={[event]} compact />;
}
