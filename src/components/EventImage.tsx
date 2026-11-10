import type { MusicEvent } from "@/lib/types";
import { EVENT_TYPE_COLOR } from "@/lib/types";

const GLYPH: Record<MusicEvent["eventType"], string> = {
  LIVE_MUSIC: "M30 14v22.5a6 6 0 1 1-3-5.2V18l14-3v18.5a6 6 0 1 1-3-5.2V11z",
  OPEN_MIC: "M32 10a6 6 0 0 1 6 6v10a6 6 0 0 1-12 0V16a6 6 0 0 1 6-6zm-10 16h3a7 7 0 0 0 14 0h3a10 10 0 0 1-8.5 9.9V41h-3v-5.1A10 10 0 0 1 22 26z",
  JAM_SESSION: "M20 38a5 5 0 1 1 0-.1zM24 37V16l18-4v21a5 5 0 1 1-3-4.6V17l-12 2.6V37z",
  KARAOKE: "M40 12a8 8 0 0 1-11.4 7.2L17 34l-3-3 14.8-11.6A8 8 0 1 1 40 12zM14 38l3 3",
  // star
  OTHER: "M32 10l6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L32 43.2 19 50l2.5-14.5L11 25.3l14.5-2.1z",
};

/** Event photo, or a colour-coded placeholder when the source had none. */
export default function EventImage({ event, className }: { event: MusicEvent; className?: string }) {
  if (event.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={event.imageUrl} alt="" className={className} loading="lazy" />;
  }
  const c = EVENT_TYPE_COLOR[event.eventType];
  return (
    <div className={`img-placeholder ${className ?? ""}`} style={{ ["--type-color" as string]: c }} aria-hidden>
      <svg viewBox="0 0 56 52" width="44" height="44">
        <path d={GLYPH[event.eventType]} fill="currentColor" stroke="currentColor" strokeWidth={event.eventType === "KARAOKE" ? 1 : 0} />
      </svg>
    </div>
  );
}
