import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, History } from "lucide-react";

type Props = {
  categories: any[];
  refreshKey: number;
  onOpenMonth: (period: string) => void;
};

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const monthEnd = (period: string) => {
  const d = new Date(`${period}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1); d.setDate(0);
  return d.toISOString().slice(0, 10);
};

export default function PlanTimeline({ categories, refreshKey, onOpenMonth }: Props) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [allocs, setAllocs] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      const { data: planRows } = await supabase.from("income_plans")
        .select("id, period, total_income, strategy").eq("user_id", user.id).order("period", { ascending: false });
      const list = planRows || [];
      setPlans(list);
      if (!list.length) { setAllocs([]); setTxs([]); setLoading(false); return; }
      const periods = list.map((p: any) => p.period).sort();
      const from = `${periods[0]}-01`;
      const to = monthEnd(periods[periods.length - 1]);
      const [a, t] = await Promise.all([
        supabase.from("plan_allocations").select("*").in("plan_id", list.map((p: any) => p.id)),
        supabase.from("transactions").select("amount, fee, type, category_id, date")
          .eq("user_id", user.id).gte("date", from).lte("date", to),
      ]);
      setAllocs(a.data || []);
      setTxs(t.data || []);
      setLoading(false);
    };
    run();
  }, [user, refreshKey]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Unassigned";
  const catIcon = (id: string | null) => categories.find((c) => c.id === id)?.icon || "🧾";

  const rowsByPlan = useMemo(() => {
    const spentKey = new Map<string, number>();
    txs.filter((t) => t.type === "expense").forEach((t) => {
      const key = `${String(t.date).slice(0, 7)}|${t.category_id || "none"}`;
      spentKey.set(key, (spentKey.get(key) || 0) + Number(t.amount) + Number(t.fee || 0));
    });
    return plans.map((p) => {
      const items = allocs.filter((a) => a.plan_id === p.id).map((a) => {
        const planned = Number(a.amount) || 0;
        const spent = a.category_id ? spentKey.get(`${p.period}|${a.category_id}`) || 0 : 0;
        return { ...a, planned, spent, remaining: planned - spent };
      });
      const planned = items.reduce((s, i) => s + i.planned, 0);
      const spent = items.reduce((s, i) => s + i.spent, 0);
      return { plan: p, items, planned, spent, remaining: planned - spent };
    });
  }, [plans, allocs, txs, categories]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Plan timeline</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading ? [0, 1].map((i) => <div key={i} className="skeleton h-16" />)
          : rowsByPlan.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-2">🗓️</div>
              <p className="text-sm text-muted-foreground">Save a plan to start building your month-by-month timeline.</p>
            </div>
          ) : rowsByPlan.map(({ plan, items, planned, spent, remaining }) => {
            const isOpen = !!open[plan.id];
            const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;
            return (
              <div key={plan.id} className="rounded-xl border">
                <button
                  className="w-full flex flex-wrap items-center justify-between gap-2 p-3 text-left"
                  onClick={() => setOpen((o) => ({ ...o, [plan.id]: !isOpen }))}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div>
                      <div className="text-sm font-medium">{monthLabel(plan.period)}</div>
                      <div className="text-xs text-muted-foreground">{items.length} envelope{items.length === 1 ? "" : "s"} · earnings {fmtKES(Number(plan.total_income))}</div>
                    </div>
                  </div>
                  <div className="text-xs text-right">
                    <div className="text-muted-foreground">Planned {fmtKES(planned)} · Spent {fmtKES(spent)}</div>
                    <div className={remaining < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
                      {remaining < 0 ? `Over by ${fmtKES(Math.abs(remaining))}` : `${fmtKES(remaining)} remaining`}
                    </div>
                  </div>
                </button>
                <div className="px-3 pb-3">
                  <Progress value={pct} className={remaining < 0 ? "[&>div]:bg-danger" : pct > 80 ? "[&>div]:bg-warning" : ""} />
                </div>
                {isOpen && (
                  <div className="border-t p-3 space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No envelopes were saved for this month.</p>
                    ) : items.map((i: any) => {
                      const ipct = i.planned > 0 ? Math.min(100, (i.spent / i.planned) * 100) : i.spent > 0 ? 100 : 0;
                      return (
                        <div key={i.id} className="space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-medium">{catIcon(i.category_id)} {i.label || catName(i.category_id)}</span>
                            <span className="text-muted-foreground">
                              Planned {fmtKES(i.planned)} · Spent {fmtKES(i.spent)} ·{" "}
                              <span className={i.remaining < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
                                {i.remaining < 0 ? `Over by ${fmtKES(Math.abs(i.remaining))}` : `${fmtKES(i.remaining)} left`}
                              </span>
                            </span>
                          </div>
                          <Progress value={ipct} className={i.remaining < 0 ? "[&>div]:bg-danger" : ipct > 80 ? "[&>div]:bg-warning" : ""} />
                        </div>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <Button size="sm" variant="outline" onClick={() => onOpenMonth(plan.period)}>Open {monthLabel(plan.period)}</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        {rowsByPlan.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {rowsByPlan.slice(0, 6).map(({ plan, remaining }) => (
              <Badge key={plan.id} variant={remaining < 0 ? "destructive" : "secondary"} className="text-[10px]">
                {monthLabel(plan.period)}: {remaining < 0 ? `over ${fmtKES(Math.abs(remaining))}` : `${fmtKES(remaining)} left`}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
