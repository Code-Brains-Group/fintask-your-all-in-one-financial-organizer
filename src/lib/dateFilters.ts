import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear } from "date-fns";

export type DateRange = { from: Date; to: Date } | null;
export type DateShortcut = "all" | "today" | "week" | "month" | "year" | "custom";

export function rangeFor(shortcut: DateShortcut, custom?: { from?: Date; to?: Date }): DateRange {
  const now = new Date();
  switch (shortcut) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "year": return { from: startOfYear(now), to: endOfYear(now) };
    case "custom":
      if (custom?.from && custom?.to) return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
      return null;
    default: return null;
  }
}

export function inRange(date: string | Date, range: DateRange): boolean {
  if (!range) return true;
  const d = new Date(date);
  return d >= range.from && d <= range.to;
}
