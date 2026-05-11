import { startOfDay, startOfWeek, endOfDay, endOfWeek } from "date-fns";

export type DateRange = { from: Date; to: Date } | null;
export type DateShortcut = "all" | "today" | "week" | "month" | "year" | "custom";

export type FiscalOpts = { monthStartDay?: number; yearStartMonth?: number };

/** Returns the start of the user's fiscal month containing `now`. */
export function fiscalMonthStart(now: Date, day = 1): Date {
  const d = Math.min(Math.max(1, day), 28);
  const ref = startOfDay(now);
  const cand = new Date(ref.getFullYear(), ref.getMonth(), d);
  if (ref < cand) cand.setMonth(cand.getMonth() - 1);
  return cand;
}
export function fiscalMonthEnd(now: Date, day = 1): Date {
  const start = fiscalMonthStart(now, day);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return endOfDay(end);
}
export function fiscalYearStart(now: Date, month = 1, day = 1): Date {
  const m = Math.min(Math.max(1, month), 12) - 1;
  const d = Math.min(Math.max(1, day), 28);
  const ref = startOfDay(now);
  const cand = new Date(ref.getFullYear(), m, d);
  if (ref < cand) cand.setFullYear(cand.getFullYear() - 1);
  return cand;
}
export function fiscalYearEnd(now: Date, month = 1, day = 1): Date {
  const start = fiscalYearStart(now, month, day);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return endOfDay(end);
}

export function rangeFor(shortcut: DateShortcut, custom?: { from?: Date; to?: Date }, fiscal?: FiscalOpts): DateRange {
  const now = new Date();
  const md = fiscal?.monthStartDay ?? 1;
  const ym = fiscal?.yearStartMonth ?? 1;
  switch (shortcut) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month": return { from: fiscalMonthStart(now, md), to: fiscalMonthEnd(now, md) };
    case "year": return { from: fiscalYearStart(now, ym, md), to: fiscalYearEnd(now, ym, md) };
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
