import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateFilter } from "@/components/DateFilter";
import { DateShortcut, DateRange, inRange, rangeFor } from "@/lib/dateFilters";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

const COLORS = ["#0175C2", "#34A853", "#F4A900", "#EA4335", "#7B61FF", "#00B8D9", "#FF6B6B", "#9333EA"];

export default function Reports() {
  const { user, fiscal } = useAuth();
  const [tx, setTx] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [filter, setFilter] = useState<{ shortcut: DateShortcut; range: DateRange; custom?: any }>({ shortcut: "month", range: rangeFor("month", undefined, fiscal) });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [t, c] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id),
        supabase.from("categories").select("*").eq("user_id", user.id),
      ]);
      setTx(t.data || []); setCats(c.data || []);
    })();
  }, [user]);

  const filtered = tx.filter(t => inRange(t.date, filter.range));
  const income = filtered.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const expense = filtered.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const fees = filtered.reduce((a, t) => a + Number(t.fee || 0), 0);
  const net = income - expense - fees;

  const byCat = cats.map(c => ({
    name: `${c.icon} ${c.name}`,
    value: filtered.filter(t => t.type === "expense" && t.category_id === c.id).reduce((a, t) => a + Number(t.amount), 0),
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  // group by day
  const byDay: Record<string, { day: string; Income: number; Expense: number }> = {};
  filtered.forEach(t => {
    const d = String(t.date).slice(0,10);
    byDay[d] ||= { day: d, Income: 0, Expense: 0 };
    if (t.type === "income") byDay[d].Income += Number(t.amount);
    else if (t.type === "expense") byDay[d].Expense += Number(t.amount) + Number(t.fee || 0);
  });
  const trend = Object.values(byDay).sort((a,b) => a.day.localeCompare(b.day));

  const exportReport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered), "Transactions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byCat), "By Category");
    XLSX.writeFile(wb, `fintask-report-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4 mr-1" /> Export</Button>
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
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  const t = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return <div className="ft-stat"><div className="text-sm text-muted-foreground">{label}</div><div className={`text-2xl font-bold mt-2 ${t}`}>{value}</div></div>;
}
