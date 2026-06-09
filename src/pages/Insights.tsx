import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Calendar } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from "recharts";

type Tx = { id: string; date: string; type: string; amount: number; fee: number | null; category_id: string | null; description: string };
type Cat = { id: string; name: string; icon: string; type: string };

const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM
const monthLabel = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
};
const nextMonthKey = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Insights() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [t, c] = await Promise.all([
        supabase.from("transactions").select("id,date,type,amount,fee,category_id,description").eq("user_id", user.id),
        supabase.from("categories").select("id,name,icon,type").eq("user_id", user.id),
      ]);
      setTxs((t.data || []) as any); setCats((c.data || []) as any);
      setLoading(false);
    })();
  }, [user]);

  const catOf = (id: string | null) => cats.find(c => c.id === id);

  const data = useMemo(() => {
    if (!txs.length) return null;

    // Months covered
    const months = Array.from(new Set(txs.map(t => monthKey(t.date)))).sort();
    const last6 = months.slice(-6);
    const last3 = months.slice(-3);

    // Spend per month (expense + fees)
    const monthlySpend: Record<string, number> = {};
    const monthlyIncome: Record<string, number> = {};
    months.forEach(m => { monthlySpend[m] = 0; monthlyIncome[m] = 0; });
    txs.forEach(t => {
      const m = monthKey(t.date);
      if (t.type === "expense") monthlySpend[m] += Number(t.amount) + Number(t.fee || 0);
      if (t.type === "income") monthlyIncome[m] += Number(t.amount);
    });

    // Spend per category (all-time + last 3 months for prediction)
    const catTotalsAll: Record<string, number> = {};
    const catTotalsRecent: Record<string, number> = {};
    const catMonthly: Record<string, Record<string, number>> = {};
    txs.filter(t => t.type === "expense").forEach(t => {
      const id = t.category_id || "uncategorized";
      const amt = Number(t.amount) + Number(t.fee || 0);
      catTotalsAll[id] = (catTotalsAll[id] || 0) + amt;
      catMonthly[id] = catMonthly[id] || {};
      const mk = monthKey(t.date);
      catMonthly[id][mk] = (catMonthly[id][mk] || 0) + amt;
      if (last3.includes(mk)) catTotalsRecent[id] = (catTotalsRecent[id] || 0) + amt;
    });

    const sortedAll = Object.entries(catTotalsAll).sort((a, b) => b[1] - a[1]);
    const topCats = sortedAll.slice(0, 5);
    const leastCats = sortedAll.slice(-3).reverse();

    // Predict next month per category = average of last 3 months (incl. months with 0)
    const predictionPerCat = Object.keys(catMonthly).map(id => {
      const totals = last3.map(m => catMonthly[id]?.[m] || 0);
      const avg = totals.reduce((a, b) => a + b, 0) / Math.max(last3.length, 1);
      // Trend factor: compare last month vs avg of prior two
      const lastM = totals[totals.length - 1] || 0;
      const priorAvg = totals.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(totals.length - 1, 1);
      const trend = priorAvg > 0 ? (lastM - priorAvg) / priorAvg : 0;
      const predicted = avg * (1 + Math.max(-0.5, Math.min(0.5, trend)) * 0.5);
      return { id, predicted, avg, trend, lastM, priorAvg };
    }).sort((a, b) => b.predicted - a.predicted);

    const totalPredicted = predictionPerCat.reduce((s, p) => s + p.predicted, 0);

    // Income avg for next month
    const incomeAvg = last3.reduce((s, m) => s + (monthlyIncome[m] || 0), 0) / Math.max(last3.length, 1);

    // Trend chart (last 6 months)
    const trendData = last6.map(m => ({
      month: monthLabel(m),
      Spend: Math.round(monthlySpend[m] || 0),
      Income: Math.round(monthlyIncome[m] || 0),
    }));

    // Insights / tips
    const tips: { icon: any; title: string; body: string; tone: "warn" | "good" | "info" }[] = [];
    const top = predictionPerCat[0];
    if (top && top.predicted > 0) {
      const c = catOf(top.id);
      tips.push({
        icon: Lightbulb, tone: "info",
        title: `Trim ${c?.icon || "💸"} ${c?.name || "top category"} by 10%`,
        body: `You spend most here. A 10% cut next month saves ~${fmtKES(top.predicted * 0.1)}.`,
      });
    }
    const rising = predictionPerCat.filter(p => p.trend > 0.2 && p.lastM > 500).slice(0, 2);
    rising.forEach(p => {
      const c = catOf(p.id);
      tips.push({
        icon: AlertTriangle, tone: "warn",
        title: `${c?.icon || "⚠️"} ${c?.name || "Category"} is rising fast`,
        body: `Up ${Math.round(p.trend * 100)}% vs prior months. Cap it before next month.`,
      });
    });
    if (incomeAvg > 0 && totalPredicted > incomeAvg * 0.9) {
      tips.push({
        icon: AlertTriangle, tone: "warn",
        title: "Predicted spend close to income",
        body: `Forecast ${fmtKES(totalPredicted)} vs avg income ${fmtKES(incomeAvg)}. Build a buffer.`,
      });
    }
    if (incomeAvg > totalPredicted && totalPredicted > 0) {
      tips.push({
        icon: TrendingUp, tone: "good",
        title: "You can save next month",
        body: `Project surplus ~${fmtKES(incomeAvg - totalPredicted)}. Auto-move it to Savings on payday.`,
      });
    }
    // Frequent small expenses
    const small = txs.filter(t => t.type === "expense" && Number(t.amount) < 200 && last3.includes(monthKey(t.date)));
    if (small.length > 15) {
      const total = small.reduce((s, t) => s + Number(t.amount) + Number(t.fee || 0), 0);
      tips.push({
        icon: Lightbulb, tone: "info",
        title: `${small.length} small purchases drained ${fmtKES(total)}`,
        body: "Bundle small buys (snacks, fares) into a weekly cash envelope.",
      });
    }

    // Day-of-week patterns
    const dow = [0,0,0,0,0,0,0];
    txs.filter(t => t.type === "expense").forEach(t => {
      const d = new Date(t.date).getDay();
      dow[d] += Number(t.amount) + Number(t.fee || 0);
    });
    const dowMax = dow.indexOf(Math.max(...dow));
    const dowNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    return {
      months, last3, monthlySpend, monthlyIncome,
      topCats, leastCats, predictionPerCat: predictionPerCat.slice(0, 6),
      totalPredicted, incomeAvg, trendData, tips, dowMax: dowNames[dowMax], dowSpend: dow[dowMax],
    };
  }, [txs, cats]);

  if (loading) return <div className="skeleton h-64" />;
  if (!data || txs.length < 3) {
    return (
      <Card><CardContent className="py-16 text-center">
        <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
        <p className="font-medium">Not enough data yet</p>
        <p className="text-sm text-muted-foreground mt-1">Add a few transactions to unlock spending insights and predictions.</p>
      </CardContent></Card>
    );
  }

  const next = nextMonthKey();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Spending Insights</h1>
        <p className="text-muted-foreground text-sm">Patterns from your history and a forecast for next month.</p>
      </div>

      {/* Forecast banner */}
      <Card className="border-primary/30 bg-primary-soft/30">
        <CardContent className="p-5 grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Forecast — {monthLabel(next)}</div>
            <div className="text-3xl font-bold mt-1">{fmtKES(data.totalPredicted)}</div>
            <div className="text-xs text-muted-foreground">Predicted spend (incl. fees)</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Avg income (3mo)</div>
            <div className="text-3xl font-bold mt-1 text-success">{fmtKES(data.incomeAvg)}</div>
            <div className="text-xs text-muted-foreground">Baseline to compare against</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Potential surplus</div>
            <div className={`text-3xl font-bold mt-1 ${data.incomeAvg - data.totalPredicted >= 0 ? "text-success" : "text-danger"}`}>
              {fmtKES(data.incomeAvg - data.totalPredicted)}
            </div>
            <div className="text-xs text-muted-foreground">If patterns hold</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-danger" /> Where you spend most</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.topCats.length === 0 ? <p className="text-sm text-muted-foreground">No expenses yet.</p> :
              data.topCats.map(([id, total]) => {
                const c = catOf(id);
                const max = data.topCats[0][1];
                return (
                  <div key={id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{c?.icon || "💸"} {c?.name || "Uncategorized"}</span>
                      <span className="font-medium">{fmtKES(total)}</span>
                    </div>
                    <Progress value={(total / max) * 100} className="h-2" />
                  </div>
                );
              })
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-success" /> Where you spend least</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.leastCats.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> :
              data.leastCats.map(([id, total]) => {
                const c = catOf(id);
                return (
                  <div key={id} className="flex justify-between text-sm border-b last:border-0 pb-2">
                    <span>{c?.icon || "💸"} {c?.name || "Uncategorized"}</span>
                    <span className="text-muted-foreground">{fmtKES(total)}</span>
                  </div>
                );
              })
            }
            <div className="pt-2 text-xs text-muted-foreground">
              Heaviest spending day: <Badge variant="outline">{data.dowMax}</Badge> · {fmtKES(data.dowSpend)} total
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Income vs Spend — last 6 months</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={data.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => fmtKES(v as number)} />
              <Legend />
              <Bar dataKey="Income" fill="hsl(var(--success))" />
              <Bar dataKey="Spend" fill="hsl(var(--danger))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Next month forecast by category</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.predictionPerCat.map(p => {
            const c = catOf(p.id);
            const trendPct = Math.round(p.trend * 100);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c?.icon || "💸"} {c?.name || "Uncategorized"}</div>
                  <div className="text-xs text-muted-foreground">3-mo avg {fmtKES(p.avg)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{fmtKES(p.predicted)}</div>
                  {Number.isFinite(trendPct) && trendPct !== 0 && (
                    <div className={`text-xs ${trendPct > 0 ? "text-danger" : "text-success"}`}>
                      {trendPct > 0 ? "▲" : "▼"} {Math.abs(trendPct)}% vs prior
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-warning" /> Tips to save next month</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.tips.length === 0 ? <p className="text-sm text-muted-foreground">Your spending is steady — keep it up!</p> :
            data.tips.map((t, i) => {
              const Icon = t.icon;
              const tone = t.tone === "warn" ? "text-danger bg-danger/10" : t.tone === "good" ? "text-success bg-success/10" : "text-primary bg-primary-soft";
              return (
                <div key={i} className={`rounded-lg p-3 flex gap-3 ${tone}`}>
                  <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm text-foreground">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.body}</div>
                  </div>
                </div>
              );
            })
          }
        </CardContent>
      </Card>
    </div>
  );
}
