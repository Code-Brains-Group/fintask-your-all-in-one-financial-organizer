import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ReportConfig, ReportRow, runReport, DEFAULT_PALETTE } from "@/lib/reportEngine";
import { fmtKES } from "@/lib/finance";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  config: ReportConfig;
  height?: number;
  // When provided, use these rows instead of fetching (used in previews and shared views)
  rowsOverride?: any[];
  lookupsOverride?: { categories: any[]; wallets: any[] };
};

export default function ReportRenderer({ config, height = 320, rowsOverride, lookupsOverride }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>(rowsOverride || []);
  const [categories, setCategories] = useState<any[]>(lookupsOverride?.categories || []);
  const [wallets, setWallets] = useState<any[]>(lookupsOverride?.wallets || []);
  const [loading, setLoading] = useState(!rowsOverride);

  useEffect(() => {
    if (rowsOverride) return;
    if (!user) return;
    (async () => {
      setLoading(true);
      const table = tableFor(config.source);
      const [d, c, w] = await Promise.all([
        supabase.from(table as any).select("*").eq("user_id", user.id).limit(5000),
        supabase.from("categories").select("*").eq("user_id", user.id),
        supabase.from("wallets").select("*").eq("user_id", user.id),
      ]);
      setRows((d as any).data || []);
      setCategories(c.data || []);
      setWallets(w.data || []);
      setLoading(false);
    })();
  }, [user?.id, config.source, rowsOverride]);

  const data: ReportRow[] = useMemo(
    () => runReport(config, rows, { categories, wallets }),
    [config, rows, categories, wallets]
  );

  const palette = config.palette || DEFAULT_PALETTE;

  if (loading) return <div className="skeleton" style={{ height }} />;
  if (data.length === 0) {
    return (
      <div className="grid place-items-center text-sm text-muted-foreground border rounded-lg" style={{ height }}>
        No data matches these filters
      </div>
    );
  }

  const fmt = (v: any) => (config.metric === "count" ? String(v) : fmtKES(Number(v)));

  if (config.chart === "stat") {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.map((r, i) => (
          <div key={r.label} className="rounded-xl border p-4 bg-card">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: palette[i % palette.length] }}>
              {fmt(r.value)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (config.chart === "table") {
    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Group</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.label}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right">{fmt(r.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        {config.chart === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: any) => fmt(v)} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
            </Bar>
          </BarChart>
        ) : config.chart === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: any) => fmt(v)} />
            <Line type="monotone" dataKey="value" stroke={palette[0]} strokeWidth={3} />
          </LineChart>
        ) : config.chart === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: any) => fmt(v)} />
            <Area type="monotone" dataKey="value" stroke={palette[0]} fill={palette[0]} fillOpacity={0.3} />
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={60} outerRadius={110} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => fmt(v)} />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function tableFor(src: ReportConfig["source"]): string {
  switch (src) {
    case "transactions": return "transactions";
    case "budgets":      return "budgets";
    case "savings":      return "savings_contributions";
    case "recurring":    return "recurring_rules";
  }
}
