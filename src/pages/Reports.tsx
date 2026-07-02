import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateFilter } from "@/components/DateFilter";
import { DateShortcut, DateRange, inRange, rangeFor } from "@/lib/dateFilters";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { Download, Lock, FileText, Trash2, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { downloadMonthReport, buildInsights, buildTips, MonthReport } from "@/lib/pdf";

const COLORS = ["#0175C2", "#34A853", "#F4A900", "#EA4335", "#7B61FF", "#00B8D9", "#FF6B6B", "#9333EA"];

export default function Reports() {
  const { user, fiscal } = useAuth();
  const [tx, setTx] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [closed, setClosed] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string>("");
  const [closeMonth, setCloseMonth] = useState<string>(""); // YYYY-MM
  const [filter, setFilter] = useState<{ shortcut: DateShortcut; range: DateRange; custom?: any }>({ shortcut: "month", range: rangeFor("month", undefined, fiscal) });

  const loadAll = async () => {
    if (!user) return;
    const [t, c, cm, p] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("closed_months").select("*").eq("user_id", user.id).order("period", { ascending: false }),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);
    setTx(t.data || []); setCats(c.data || []); setClosed(cm.data || []);
    setProfileName((p.data as any)?.display_name || user.email || "User");
  };
  useEffect(() => { loadAll(); }, [user]);

  const filtered = tx.filter(t => inRange(t.date, filter.range));
  const income = filtered.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const expense = filtered.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const fees = filtered.reduce((a, t) => a + Number(t.fee || 0), 0);
  const net = income - expense - fees;

  const byCat = cats.map(c => ({
    name: `${c.icon} ${c.name}`,
    value: filtered.filter(t => t.type === "expense" && t.category_id === c.id).reduce((a, t) => a + Number(t.amount), 0),
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const byDay: Record<string, { day: string; Income: number; Expense: number }> = {};
  filtered.forEach(t => {
    const d = String(t.date).slice(0,10);
    byDay[d] ||= { day: d, Income: 0, Expense: 0 };
    if (t.type === "income") byDay[d].Income += Number(t.amount);
    else if (t.type === "expense") byDay[d].Expense += Number(t.amount) + Number(t.fee || 0);
  });
  const trend = Object.values(byDay).sort((a,b) => a.day.localeCompare(b.day));

  // Determine "current month" for close action, respecting fiscal start
  const currentMonth = useMemo(() => {
    const startDay = fiscal?.monthStartDay || 1;
    const now = new Date();
    const anchor = new Date(now);
    if (anchor.getDate() < startDay) anchor.setMonth(anchor.getMonth() - 1);
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const start = new Date(y, m, startDay);
    const end = new Date(y, m + 1, startDay - 1, 23, 59, 59);
    const label = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const period = `${y}-${String(m + 1).padStart(2, "0")}`;
    return { start, end, label, period };
  }, [fiscal]);

  const alreadyClosed = closed.some(c => c.period === currentMonth.period);

  const closeCurrentMonth = async () => {
    if (alreadyClosed) { toast.error("Month already closed"); return; }
    if (!confirm(`Close ${currentMonth.label}? You can reopen or delete it later.`)) return;

    const monthTx = tx.filter(t => {
      const d = new Date(t.date);
      return d >= currentMonth.start && d <= currentMonth.end;
    });
    const inc = monthTx.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
    const exp = monthTx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
    const fee = monthTx.reduce((a, t) => a + Number(t.fee || 0), 0);
    const byC = cats.map(c => ({
      name: `${c.icon} ${c.name}`,
      value: monthTx.filter(t => t.type === "expense" && t.category_id === c.id).reduce((a, t) => a + Number(t.amount), 0),
    })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

    // Previous month for trend
    const prevStart = new Date(currentMonth.start); prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(currentMonth.end); prevEnd.setMonth(prevEnd.getMonth() - 1);
    const prevExp = tx.filter(t => {
      const d = new Date(t.date); return d >= prevStart && d <= prevEnd && t.type === "expense";
    }).reduce((a, t) => a + Number(t.amount), 0);

    const insights = buildInsights(inc, exp, byC, prevExp || undefined);
    const tips = buildTips(inc, exp, byC);

    const summary = {
      periodLabel: currentMonth.label,
      income: inc, expense: exp, fees: fee, net: inc - exp - fee,
      txCount: monthTx.length,
      byCategory: byC,
      insights, nextMonthTips: tips,
    };

    const { error } = await supabase.from("closed_months").insert({
      user_id: user!.id,
      period: currentMonth.period,
      closed_by_name: profileName,
      summary: summary as any,
      insights: insights.join(" • "),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${currentMonth.label} closed`);
    loadAll();
  };

  const downloadClosedPdf = (c: any) => {
    const s = c.summary || {};
    const report: MonthReport = {
      period: c.period,
      periodLabel: s.periodLabel || c.period,
      generatedBy: c.closed_by_name || "—",
      generatedAt: c.closed_at,
      income: Number(s.income || 0),
      expense: Number(s.expense || 0),
      fees: Number(s.fees || 0),
      net: Number(s.net || 0),
      txCount: Number(s.txCount || 0),
      byCategory: s.byCategory || [],
      insights: s.insights || [],
      nextMonthTips: s.nextMonthTips || [],
    };
    downloadMonthReport(report);
  };

  const reopen = async (c: any) => {
    if (!confirm(`Reopen ${c.summary?.periodLabel || c.period}? This will remove the closed record.`)) return;
    await supabase.from("closed_months").delete().eq("id", c.id);
    toast.success("Reopened"); loadAll();
  };

  const exportReport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered), "Transactions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byCat), "By Category");
    XLSX.writeFile(wb, `fintask-report-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const downloadCurrentPdf = () => {
    const report: MonthReport = {
      period: new Date().toISOString().slice(0, 7),
      periodLabel: "Current view",
      generatedBy: profileName,
      generatedAt: new Date().toISOString(),
      income, expense, fees, net,
      txCount: filtered.length,
      byCategory: byCat,
      insights: buildInsights(income, expense, byCat),
      nextMonthTips: buildTips(income, expense, byCat),
    };
    downloadMonthReport(report);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4 mr-1" /> Excel</Button>
          <Button variant="outline" onClick={downloadCurrentPdf}><FileText className="h-4 w-4 mr-1" /> PDF (current view)</Button>
          <Button onClick={closeCurrentMonth} disabled={alreadyClosed}>
            <Lock className="h-4 w-4 mr-1" /> {alreadyClosed ? `${currentMonth.label} closed` : `Close ${currentMonth.label}`}
          </Button>
        </div>
      </div>

      <Card><CardContent className="p-4"><DateFilter value={filter} onChange={setFilter} fiscal={fiscal} /></CardContent></Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Income" value={fmtKES(income)} tone="success" />
        <Stat label="Expenses" value={fmtKES(expense)} tone="danger" />
        <Stat label="Fees" value={fmtKES(fees)} tone="warning" />
        <Stat label="Net" value={fmtKES(net)} tone={net >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Daily trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip formatter={(v:any) => fmtKES(v as number)} /><Legend />
              <Bar dataKey="Income" fill="hsl(var(--success))" />
              <Bar dataKey="Expense" fill="hsl(var(--danger))" />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Spending by category</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byCat.length === 0 ? <div className="text-center text-muted-foreground text-sm py-12">No expenses</div> :
            <ResponsiveContainer><PieChart>
              <Pie data={byCat} dataKey="value" innerRadius={50} outerRadius={90}>
                {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v:any) => fmtKES(v as number)} />
            </PieChart></ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      {/* Closed months */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Closed months</CardTitle>
          <span className="text-xs text-muted-foreground">{closed.length} total</span>
        </CardHeader>
        <CardContent>
          {closed.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <div className="text-4xl mb-2">🔒</div>
              Nothing closed yet. Use "Close {currentMonth.label}" to snapshot this month and generate insights.
            </div>
          ) : (
            <div className="space-y-3">
              {closed.map(c => {
                const s = c.summary || {};
                return (
                  <div key={c.id} className="rounded-lg border p-4 bg-card">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {s.periodLabel || c.period}
                          <Badge variant="outline" className="text-[10px]">Closed</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Closed by {c.closed_by_name || "—"} on {fmtDate(c.closed_at)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadClosedPdf(c)}>
                          <FileText className="h-4 w-4 mr-1" /> PDF
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => reopen(c)}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Reopen
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                      <MiniStat label="Income" value={fmtKES(s.income || 0)} tone="success" />
                      <MiniStat label="Expenses" value={fmtKES(s.expense || 0)} tone="danger" />
                      <MiniStat label="Fees" value={fmtKES(s.fees || 0)} tone="warning" />
                      <MiniStat label="Net" value={fmtKES(s.net || 0)} tone={(s.net || 0) >= 0 ? "success" : "danger"} />
                    </div>
                    {s.insights?.length ? (
                      <div className="mt-3 text-xs">
                        <div className="font-medium mb-1">Highlights</div>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {s.insights.slice(0, 3).map((line: string, i: number) => <li key={i}>{line}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {s.nextMonthTips?.length ? (
                      <div className="mt-2 text-xs">
                        <div className="font-medium mb-1">Next month</div>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {s.nextMonthTips.slice(0, 2).map((line: string, i: number) => <li key={i}>{line}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  const t = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return <div className="ft-stat"><div className="text-sm text-muted-foreground">{label}</div><div className={`text-2xl font-bold mt-2 ${t}`}>{value}</div></div>;
}

function MiniStat({ label, value, tone }: any) {
  const t = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-semibold ${t}`}>{value}</div>
    </div>
  );
}
