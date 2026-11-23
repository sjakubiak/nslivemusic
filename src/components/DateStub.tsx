/** The date on the left of a listing, like a ticket stub: "FRI / 13 / NOV". */
export default function DateStub({ iso }: { iso: string }) {
  const d = new Date(iso);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Halifax", ...o }).format(d);
  return (
    <span className="stub">
      <span className="stub-dow">{part({ weekday: "short" }).replace(".", "")}</span>
      <span className="stub-day">{part({ day: "numeric" })}</span>
      <span className="stub-mon">{part({ month: "short" }).replace(".", "")}</span>
    </span>
  );
}
