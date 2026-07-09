// Pure client-side report engine. Runs a ReportConfig against fetched rows.
import { rangeFor, inRange, DateShortcut } from "@/lib/dateFilters";

export type ReportSource = "transactions" | "budgets" | "savings" | "recurring";
export type ReportMetric = "sum_amount" | "count" | "avg_amount" | "net";
export type ReportGroupBy = "category" | "wallet" | "day" | "week" | "month" | "type" | "none";
export type ReportChart = "bar" | "line" | "area" | "pie" | "stat" | "table";
export type ReportSort = "value_desc" | "value_asc" | "label_asc" | "label_desc";

export type ReportConfig = {
  source: ReportSource;
  metric: ReportMetric;
  groupBy: ReportGroupBy;
  chart: ReportChart;
  sort?: ReportSort;
  limit?: number;
  filters?: {
    dateShortcut?: DateShortcut;
    txType?: "all" | "income" | "expense" | "transfer";
    walletIds?: string[];
    categoryIds?: string[];
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  };
  palette?: string[];
};

export const DEFAULT_PALETTE = [
  "#0175C2", "#34A853", "#F4A900", "#EA4335",
  "#7B61FF", "#00B8D9", "#FF6B6B", "#9333EA",
  "#10B981", "#F97316",
];

export type Lookups = {
  categories: any[];
  wallets: any[];
};

export type ReportRow = { label: string; value: number; secondary?: number; raw?: any };

function labelForCategory(id: string | null, cats: any[]) {
  const c = cats.find(x => x.id === id);
  return c ? `${c.icon || ""} ${c.name}`.trim() : "Uncategorized";
}
function labelForWallet(id: string | null, wallets: any[]) {
  return wallets.find(w => w.id === id)?.name || "—";
}
function weekKey(d: Date) {
  const c = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = c.getUTCDay() || 7;
  c.setUTCDate(c.getUTCDate() + 4 - day);
  const yStart = new Date(Date.UTC(c.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((c.getTime() - yStart.getTime()) / 86400000) + 1) / 7);
  return `${c.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

export function runReport(cfg: ReportConfig, rowsIn: any[], lookups: Lookups): ReportRow[] {
  const f = cfg.filters || {};
  // 1. Filter
  let rows = rowsIn.slice();
  if (cfg.source === "transactions") {
    if (f.dateShortcut && f.dateShortcut !== "all") {
      const rng = rangeFor(f.dateShortcut, undefined, { monthStartDay: 1, yearStartMonth: 1 });
      rows = rows.filter(r => inRange(r.date, rng));
    }
    if (f.txType && f.txType !== "all") rows = rows.filter(r => r.type === f.txType);
    if (f.walletIds?.length) rows = rows.filter(r => f.walletIds!.includes(r.wallet_id));
    if (f.categoryIds?.length) rows = rows.filter(r => f.categoryIds!.includes(r.category_id));
    if (f.minAmount != null) rows = rows.filter(r => Number(r.amount) >= f.minAmount!);
    if (f.maxAmount != null) rows = rows.filter(r => Number(r.amount) <= f.maxAmount!);
    if (f.search) {
      const q = f.search.toLowerCase();
      rows = rows.filter(r => String(r.description || "").toLowerCase().includes(q));
    }
  }

  // 2. Group
  const groupKey = (r: any): string => {
    switch (cfg.groupBy) {
      case "category": return labelForCategory(r.category_id, lookups.categories);
      case "wallet":   return labelForWallet(r.wallet_id, lookups.wallets);
      case "type":     return String(r.type || "—");
      case "day":      return String(r.date).slice(0, 10);
      case "week":     return weekKey(new Date(r.date));
      case "month":    return String(r.date).slice(0, 7);
      case "none":     return "Total";
    }
  };

  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const k = groupKey(r);
    const arr = groups.get(k) || [];
    arr.push(r);
    groups.set(k, arr);
  }

  const compute = (arr: any[]) => {
    const amounts = arr.map(x => Number(x.amount) || 0);
    switch (cfg.metric) {
      case "sum_amount": return amounts.reduce((a, b) => a + b, 0);
      case "count":      return arr.length;
      case "avg_amount": return amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
      case "net": {
        const inc = arr.filter(x => x.type === "income").reduce((a, x) => a + Number(x.amount), 0);
        const exp = arr.filter(x => x.type === "expense").reduce((a, x) => a + Number(x.amount) + Number(x.fee || 0), 0);
        return inc - exp;
      }
    }
  };

  let out: ReportRow[] = Array.from(groups.entries()).map(([label, arr]) => ({
    label, value: compute(arr), raw: arr,
  }));

  // 3. Sort
  switch (cfg.sort || "value_desc") {
    case "value_desc": out.sort((a, b) => b.value - a.value); break;
    case "value_asc":  out.sort((a, b) => a.value - b.value); break;
    case "label_asc":  out.sort((a, b) => a.label.localeCompare(b.label)); break;
    case "label_desc": out.sort((a, b) => b.label.localeCompare(a.label)); break;
  }

  if (cfg.limit && cfg.limit > 0) out = out.slice(0, cfg.limit);
  return out;
}

export const METRIC_LABEL: Record<ReportMetric, string> = {
  sum_amount: "Sum of amount",
  count: "Number of records",
  avg_amount: "Average amount",
  net: "Net (income − expense)",
};

export const GROUP_LABEL: Record<ReportGroupBy, string> = {
  category: "Category",
  wallet: "Wallet",
  day: "Day",
  week: "Week",
  month: "Month",
  type: "Transaction type",
  none: "No grouping (single total)",
};

export const CHART_LABEL: Record<ReportChart, string> = {
  bar: "Bar chart",
  line: "Line chart",
  area: "Area chart",
  pie: "Pie / donut",
  stat: "Stat cards",
  table: "Data table",
};
