// Shared forecasting engine.
// Used by Insights, the Planner suggestion and reports so every screen tells
// the same story: one baseline (last 3 months with data), one trend model.

export type ForecastTx = {
  date: string;
  type: string;
  amount: number | string;
  fee?: number | string | null;
  category_id?: string | null;
};

export type CategoryForecast = {
  id: string; // category id, or "uncategorized"
  avg: number; // plain 3-month average
  lastMonth: number;
  priorAvg: number;
  trend: number; // -1..n relative change of last month vs prior months
  predicted: number; // trend-adjusted forecast for next month
};

export const monthKey = (d: string) => String(d).slice(0, 7);

export const monthLabel = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
};

const val = (t: ForecastTx) => Number(t.amount || 0) + Number(t.fee || 0);

/** The last `count` calendar months that actually contain transactions. */
export function baselineMonths(txs: ForecastTx[], count = 3): string[] {
  const months = Array.from(new Set(txs.map((t) => monthKey(t.date)))).sort();
  return months.slice(-count);
}

/**
 * Trend-adjusted forecast per expense category for the next month.
 * predicted = 3-month average * (1 + clamped trend * 0.5)
 */
export function forecastByCategory(txs: ForecastTx[], count = 3): CategoryForecast[] {
  const months = baselineMonths(txs, count);
  const perCat: Record<string, Record<string, number>> = {};

  txs.filter((t) => t.type === "expense").forEach((t) => {
    const id = t.category_id || "uncategorized";
    const mk = monthKey(t.date);
    perCat[id] = perCat[id] || {};
    perCat[id][mk] = (perCat[id][mk] || 0) + val(t);
  });

  return Object.keys(perCat)
    .map((id) => {
      const totals = months.map((m) => perCat[id]?.[m] || 0);
      const avg = totals.reduce((a, b) => a + b, 0) / Math.max(months.length, 1);
      const lastMonth = totals[totals.length - 1] || 0;
      const priorAvg = totals.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(totals.length - 1, 1);
      const trend = priorAvg > 0 ? (lastMonth - priorAvg) / priorAvg : 0;
      const predicted = avg * (1 + Math.max(-0.5, Math.min(0.5, trend)) * 0.5);
      return { id, avg, lastMonth, priorAvg, trend, predicted };
    })
    .sort((a, b) => b.predicted - a.predicted);
}

/** Average monthly income over the same baseline window. */
export function forecastIncome(txs: ForecastTx[], count = 3): number {
  const months = baselineMonths(txs, count);
  const totals: Record<string, number> = {};
  months.forEach((m) => (totals[m] = 0));
  txs.filter((t) => t.type === "income").forEach((t) => {
    const mk = monthKey(t.date);
    if (mk in totals) totals[mk] += Number(t.amount || 0);
  });
  return months.reduce((s, m) => s + (totals[m] || 0), 0) / Math.max(months.length, 1);
}

export function totalPredicted(forecasts: CategoryForecast[]): number {
  return forecasts.reduce((s, f) => s + f.predicted, 0);
}
