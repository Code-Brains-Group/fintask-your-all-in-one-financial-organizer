// Generate an .ics calendar file for tasks/applications/reminders.
function pad(n: number) { return String(n).padStart(2, "0"); }
function toICS(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function esc(s: string) { return (s || "").replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n"); }

export type CalEvent = {
  id: string; title: string; description?: string | null;
  start: Date; end?: Date; location?: string | null; url?: string | null;
};

export function buildICS(events: CalEvent[], calName = "FinTask"): string {
  const now = toICS(new Date());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FinTask//EN",
    `X-WR-CALNAME:${esc(calName)}`, "CALSCALE:GREGORIAN",
  ];
  for (const e of events) {
    const end = e.end || new Date(e.start.getTime() + 60 * 60 * 1000);
    lines.push("BEGIN:VEVENT",
      `UID:${e.id}@fintask`, `DTSTAMP:${now}`,
      `DTSTART:${toICS(e.start)}`, `DTEND:${toICS(end)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.url ? [`URL:${esc(e.url)}`] : []),
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:-PT30M", "END:VALARM",
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Google Calendar quick-add URL
export function googleCalUrl(e: CalEvent): string {
  const fmt = (d: Date) => toICS(d);
  const end = e.end || new Date(e.start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(end)}`,
    details: e.description || "",
    location: e.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
