import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { forecastByCategory, forecastIncome } from "@/lib/forecast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Save, Trash2, Wand2, AlertTriangle, Copy, Sparkles, CalendarRange,
  ChevronLeft, ChevronRight, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import PlanTemplates from "@/components/planner/PlanTemplates";
import PlanTimeline from "@/components/planner/PlanTimeline";

type Row = { id?: string; category_id: string | null; label: string; percent: number; amount: number };
type PlanRow = { id: string; period: string; total_income: number; strategy: string };

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const monthShort = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

const shiftPeriod = (period: string, months: number) => {
  const d = new Date(`${period}-01T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 7);
};

export default function Planner() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [planId, setPlanId] = useState<string | null>(null);
  const [income, setIncome] = useState("");
  const [strategy, setStrategy] = useState<"amount" | "percent">("amount");
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const start = `${period}-01`;
  const end = useMemo(() => {
    const d = new Date(`${period}-01T00:00:00`);
    d.setMonth(d.getMonth() + 1); d.setDate(0);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const loadPlans = async () => {
    if (!user) return;
    const { data } = await supabase.from("income_plans").select("id, period, total_income, strategy")
      .eq("user_id", user.id).order("period", { ascending: false });
    setPlans((data || []) as PlanRow[]);
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const histStart = `${shiftPeriod(period, -12)}-01`;
    const [plan, cats, tx, hist] = await Promise.all([
      supabase.from("income_plans").select("*").eq("user_id", user.id).eq("period", period).maybeSingle(),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("id, amount, fee, type, category_id, date, description")
        .eq("user_id", user.id).gte("date", start).lte("date", end),
      // Same window the Insights page uses, so both screens forecast identically
      supabase.from("transactions").select("amount, fee, type, category_id, date")
        .eq("user_id", user.id).gte("date", histStart).lt("date", start),
    ]);

    setCategories(cats.data || []);
    setTxs(tx.data || []);
    setHistory(hist.data || []);
    if (plan.data) {
      setPlanId(plan.data.id);
      setIncome(String(Number(plan.data.total_income) || ""));
      setStrategy((plan.data.strategy as any) || "amount");
      const allocs = await supabase.from("plan_allocations").select("*").eq("plan_id", plan.data.id).order("created_at");
      setRows((allocs.data || []).map((a: any) => ({
        id: a.id, category_id: a.category_id, label: a.label || "",
        percent: Number(a.percent) || 0, amount: Number(a.amount) || 0,
      })));
    } else {
      setPlanId(null); setIncome(""); setStrategy("amount"); setRows([]);
    }
    setDirty(false);
    setLoading(false);
    loadPlans();
  };

  useEffect(() => { load(); }, [user, period]);

  const earnings = Number(income) || 0;
  const expenseCats = categories.filter((c) => c.type === "expense");
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Unassigned";
  const catIcon = (id: string | null) => categories.find((c) => c.id === id)?.icon || "🧾";
  const catKind = (id: string | null) => categories.find((c) => c.id === id)?.need_kind || null;

  const plannedFor = (row: Row) => strategy === "percent" ? (earnings * (row.percent || 0)) / 100 : row.amount || 0;
  const spentFor = (row: Row) => txs
    .filter((t) => t.type === "expense" && t.category_id && t.category_id === row.category_id)
    .reduce((sum, t) => sum + Number(t.amount) + Number(t.fee || 0), 0);

  const allocated = rows.reduce((sum, row) => sum + plannedFor(row), 0);
  const unallocated = earnings - allocated;
  const totalSpent = txs.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount) + Number(t.fee || 0), 0);
  const leftFromEarnings = earnings - totalSpent;
  const overspentRows = rows.filter((row) => spentFor(row) > plannedFor(row));

  const needTotal = rows.filter((r) => catKind(r.category_id) === "need").reduce((s, r) => s + plannedFor(r), 0);
  const wantTotal = rows.filter((r) => catKind(r.category_id) === "want").reduce((s, r) => s + plannedFor(r), 0);
  const saveTotal = rows.filter((r) => !r.category_id || catKind(r.category_id) === "savings").reduce((s, r) => s + plannedFor(r), 0);

  const touch = () => setDirty(true);
  const setRow = (index: number, patch: Partial<Row>) => {
    touch();
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const addRow = (categoryId: string | null = null) => {
    touch();
    setRows((current) => [...current, { category_id: categoryId, label: "", percent: 0, amount: 0 }]);
  };
  const removeRow = (index: number) => { touch(); setRows((current) => current.filter((_, i) => i !== index)); };

  // Forecast for next month, straight from the shared engine that powers Insights.
  const forecasts = useMemo(() => forecastByCategory(history as any), [history]);
  const forecastMap = useMemo(() => {
    const map = new Map<string, number>();
    forecasts.forEach((f) => map.set(f.id, f.predicted));
    return map;
  }, [forecasts]);
  const forecastSpend = useMemo(
    () => forecasts.filter((f) => f.id !== "uncategorized").reduce((s, f) => s + f.predicted, 0),
    [forecasts]
  );
  const forecastIncomeAvg = useMemo(() => forecastIncome(history as any), [history]);

  /**
   * Suggestion = the Insights forecast per category (so both pages quote the
   * same number), with anything left over parked in savings.
   */
  const buildSuggestion = (base: number): Row[] => {
    const covered = expenseCats.filter((c) => forecastMap.get(c.id));
    const rawTotal = covered.reduce((s, c) => s + (forecastMap.get(c.id) || 0), 0);
    const over = rawTotal > base && base > 0;
    const scale = over ? base / rawTotal : 1;

    const result: Row[] = covered.map((c) => {
      const amount = Math.round((forecastMap.get(c.id) || 0) * scale);
      return { category_id: c.id, label: "", percent: base ? (amount / base) * 100 : 0, amount };
    });

    const leftover = Math.round(base - result.reduce((s, r) => s + r.amount, 0));
    if (leftover > 0) {
      const savingsCat = expenseCats.find((c) => c.need_kind === "savings");
      result.push({
        category_id: savingsCat?.id || null,
        label: savingsCat ? "" : "Savings & investments",
        percent: base ? (leftover / base) * 100 : 0,
        amount: leftover,
      });
    }
    return result.filter((r) => r.amount > 0);
  };

  const applyRule = () => {
    if (!earnings) { toast.error("Enter your expected earnings first"); return; }
    const preset = buildSuggestion(earnings);
    if (!preset.length) { toast.error("Not enough spending history yet — add a few transactions first"); return; }
    setRows(preset);
    setStrategy("amount");
    touch();
    toast.success("Applied your forecast — same numbers as the Insights page");
  };

  const balanceRemainder = () => {
    if (!rows.length || !earnings) return;
    const leftover = unallocated;
    if (Math.abs(leftover) < 1) { toast.info("Already fully allocated"); return; }
    const last = rows.length - 1;
    if (strategy === "percent") {
      setRow(last, { percent: Math.max(0, Math.round(((plannedFor(rows[last]) + leftover) / earnings) * 1000) / 10) });
    } else {
      setRow(last, { amount: Math.max(0, Math.round(plannedFor(rows[last]) + leftover)) });
    }
    toast.success(`Moved ${fmtKES(Math.abs(leftover))} into ${rows[last].label || catName(rows[last].category_id)}`);
  };

  const save = async () => {
    if (!user) return;
    if (!earnings) { toast.error("Enter your expected earnings for the month"); return; }
    setSaving(true);
    const { data: plan, error } = await supabase.from("income_plans")
      .upsert({ user_id: user.id, period, total_income: earnings, strategy }, { onConflict: "user_id,period" })
      .select("id").single();
    if (error || !plan) { setSaving(false); toast.error(error?.message || "Could not save plan"); return; }
    await supabase.from("plan_allocations").delete().eq("plan_id", plan.id);
    if (rows.length) {
      const { error: allocError } = await supabase.from("plan_allocations").insert(rows.map((row) => ({
        user_id: user.id, plan_id: plan.id, category_id: row.category_id,
        label: row.label || null,
        percent: strategy === "percent" ? row.percent || 0 : earnings ? ((row.amount || 0) / earnings) * 100 : 0,
        amount: strategy === "percent" ? (earnings * (row.percent || 0)) / 100 : row.amount || 0,
      })));
      if (allocError) { setSaving(false); toast.error(allocError.message); return; }
    }
    setPlanId(plan.id);
    setSaving(false);
    toast.success("Plan saved");
    setRefreshKey((k) => k + 1);
    load();
  };

  const removePlan = async (id?: string, label?: string) => {
    const target = id || planId;
    if (!target) return;
    if (!confirm(`Delete the plan for ${label || monthLabel(period)}?`)) return;
    await supabase.from("income_plans").delete().eq("id", target);
    toast.success("Plan deleted");
    if (target === planId) load(); else loadPlans();
  };

  // Copy the current plan into another month
  const copyTo = async (targetPeriod: string) => {
    if (!user) return;
    if (!earnings) { toast.error("Nothing to copy — this month has no plan yet"); return; }
    const { data: plan, error } = await supabase.from("income_plans")
      .upsert({ user_id: user.id, period: targetPeriod, total_income: earnings, strategy }, { onConflict: "user_id,period" })
      .select("id").single();
    if (error || !plan) { toast.error(error?.message || "Could not copy plan"); return; }
    await supabase.from("plan_allocations").delete().eq("plan_id", plan.id);
    if (rows.length) {
      await supabase.from("plan_allocations").insert(rows.map((row) => ({
        user_id: user.id, plan_id: plan.id, category_id: row.category_id, label: row.label || null,
        percent: strategy === "percent" ? row.percent || 0 : earnings ? ((row.amount || 0) / earnings) * 100 : 0,
        amount: strategy === "percent" ? (earnings * (row.percent || 0)) / 100 : row.amount || 0,
      })));
    }
    toast.success(`Plan copied to ${monthLabel(targetPeriod)}`);
    loadPlans();
  };

  const nextPeriod = shiftPeriod(period, 1);
  const nextPlanExists = plans.some((p) => p.period === nextPeriod);
  const suggestedNext = useMemo(() => {
    if (!earnings) return [];
    return buildSuggestion(earnings);
  }, [earnings, categories, history]);

  const draftSuggestionForNext = async () => {
    if (!user || !earnings) { toast.error("Save this month's earnings first"); return; }
    const preset = buildSuggestion(earnings);
    if (!preset.length) { toast.error("Not enough spending history yet to forecast next month"); return; }
    const { data: plan, error } = await supabase.from("income_plans")
      .upsert({ user_id: user.id, period: nextPeriod, total_income: earnings, strategy: "amount" }, { onConflict: "user_id,period" })
      .select("id").single();
    if (error || !plan) { toast.error(error?.message || "Could not create plan"); return; }
    await supabase.from("plan_allocations").delete().eq("plan_id", plan.id);
    await supabase.from("plan_allocations").insert(preset.map((row) => ({
      user_id: user.id, plan_id: plan.id, category_id: row.category_id, label: row.label || null,
      percent: row.percent, amount: row.amount,
    })));
    toast.success(`Suggested plan created for ${monthLabel(nextPeriod)}`);
    setPeriod(nextPeriod);
  };

  const usedCatIds = new Set(rows.map((r) => r.category_id).filter(Boolean) as string[]);
  const pickable = expenseCats.filter((c) => !usedCatIds.has(c.id));
  const allocPct = earnings > 0 ? Math.min(100, (allocated / earnings) * 100) : 0;
  const planMonths = plans.map((p) => p.period);

  return (
    <div className="space-y-5 pb-24">
      {/* Month rail */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[9.5rem]">
            <div className="text-lg font-bold leading-tight">{monthLabel(period)}</div>
            <div className="text-[11px] text-muted-foreground">
              {planId ? "Saved plan" : "No plan yet"}{dirty ? " · unsaved changes" : ""}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {[-2, -1, 0, 1, 2].map((offset) => {
            const p = shiftPeriod(new Date().toISOString().slice(0, 7), offset);
            const has = planMonths.includes(p);
            return (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-full text-xs border whitespace-nowrap transition-colors ${
                  p === period ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                }`}>
                {monthShort(p)}{has ? " •" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="plan">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="next">Next month</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ---------------- PLAN ---------------- */}
        <TabsContent value="plan" className="space-y-4 mt-4">
          {/* Earnings + allocation meter */}
          <Card className="overflow-hidden">
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <Label className="text-xs text-muted-foreground">Expected earnings</Label>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">KES</span>
                    <Input type="number" inputMode="decimal" value={income}
                      onChange={(e) => { setIncome(e.target.value); touch(); }}
                      placeholder="0"
                      className="h-11 text-2xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0" />
                  </div>
                  {forecastIncomeAvg > 0 && !earnings && (
                    <button type="button" onClick={() => { setIncome(String(Math.round(forecastIncomeAvg))); touch(); }}
                      className="text-xs text-primary hover:underline mt-1">
                      Use my 3-month average ({fmtKES(forecastIncomeAvg)})
                    </button>
                  )}
                </div>
                <div className="flex gap-1 rounded-lg border p-1 self-end">
                  {(["amount", "percent"] as const).map((mode) => (
                    <Button key={mode} size="sm" variant={strategy === mode ? "default" : "ghost"}
                      onClick={() => { setStrategy(mode); touch(); }}>
                      {mode === "amount" ? "Amounts" : "%"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-primary transition-all" style={{ width: `${Math.min(100, (needTotal / (earnings || 1)) * 100)}%` }} />
                  <div className="bg-warning transition-all" style={{ width: `${Math.min(100, (wantTotal / (earnings || 1)) * 100)}%` }} />
                  <div className="bg-success transition-all" style={{ width: `${Math.min(100, (saveTotal / (earnings || 1)) * 100)}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">
                    Allocated <span className="font-semibold text-foreground">{fmtKES(allocated)}</span> of {fmtKES(earnings)} ({Math.round(allocPct)}%)
                  </span>
                  <span className={unallocated < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
                    {unallocated < 0 ? `Over-allocated by ${fmtKES(Math.abs(unallocated))}` : `${fmtKES(unallocated)} still free`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-primary inline-block" /> Needs {fmtKES(needTotal)}</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-warning inline-block" /> Wants {fmtKES(wantTotal)}</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-success inline-block" /> Savings {fmtKES(saveTotal)}</span>
                  <span>· Spent so far {fmtKES(totalSpent)} · {leftFromEarnings < 0 ? "over" : "left"} {fmtKES(Math.abs(leftFromEarnings))}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={applyRule}><Wand2 className="h-4 w-4 mr-1" /> Draft from forecast</Button>
                {rows.length > 0 && Math.abs(unallocated) >= 1 && (
                  <Button size="sm" variant="outline" onClick={balanceRemainder}>
                    {unallocated > 0 ? "Park the rest" : "Trim the excess"}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => copyTo(nextPeriod)}><Copy className="h-4 w-4 mr-1" /> Copy to {monthShort(nextPeriod)}</Button>
                {planId && <Button size="sm" variant="ghost" onClick={() => removePlan()}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>}
              </div>

              {forecastSpend > 0 && earnings > 0 && forecastSpend > earnings && (
                <p className="text-xs text-danger">
                  Your forecast spend ({fmtKES(forecastSpend)}) is above these earnings — drafted envelopes get scaled down evenly.
                </p>
              )}
            </CardContent>
          </Card>

          {overspentRows.length > 0 && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-danger">{overspentRows.length} envelope{overspentRows.length > 1 ? "s are" : " is"} in the red.</span>{" "}
                {overspentRows.map((row) => row.label || catName(row.category_id)).join(", ")}
              </div>
            </div>
          )}

          {/* Envelopes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Envelopes {rows.length > 0 && <span className="text-muted-foreground font-normal">({rows.length})</span>}</CardTitle>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {pickable.map((c) => (
                      <button key={c.id} onClick={() => { addRow(c.id); setPickerOpen(false); }}
                        className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <span>{c.icon} {c.name}</span>
                        {forecastMap.get(c.id) ? (
                          <span className="text-[10px] text-muted-foreground">{fmtKES(forecastMap.get(c.id) || 0)}</span>
                        ) : null}
                      </button>
                    ))}
                    <button onClick={() => { addRow(null); setPickerOpen(false); }}
                      className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted text-muted-foreground">
                      + Custom envelope (no category)
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-14" />)
                : rows.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-3">🧧</div>
                    <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
                      Split your earnings into envelopes like Food, Rent or Savings — then every transaction eats from its envelope.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={applyRule}><Wand2 className="h-4 w-4 mr-1" /> Draft from my forecast</Button>
                      <Button variant="outline" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add manually</Button>
                    </div>
                  </div>
                ) : rows.map((row, index) => (
                  <EnvelopeRow
                    key={row.id || index}
                    row={row}
                    index={index}
                    strategy={strategy}
                    earnings={earnings}
                    planned={plannedFor(row)}
                    spent={spentFor(row)}
                    icon={catIcon(row.category_id)}
                    name={catName(row.category_id)}
                    kind={catKind(row.category_id)}
                    forecast={row.category_id ? forecastMap.get(row.category_id) || 0 : 0}
                    expenseCats={expenseCats}
                    onChange={(patch) => setRow(index, patch)}
                    onRemove={() => removeRow(index)}
                  />
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- NEXT MONTH ---------------- */}
        <TabsContent value="next" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Suggested plan for {monthLabel(nextPeriod)}
              </CardTitle>
              {!nextPlanExists && suggestedNext.length > 0 && (
                <Button size="sm" onClick={draftSuggestionForNext}>Create it</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {nextPlanExists ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  You already have a plan for {monthLabel(nextPeriod)}.
                  <Button size="sm" variant="outline" onClick={() => setPeriod(nextPeriod)}>Open it</Button>
                </div>
              ) : suggestedNext.length === 0 ? (
                <p className="text-sm text-muted-foreground">Enter your expected earnings on the Plan tab — we'll draft the split from your spending forecast.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Each envelope matches the forecast shown on Insights (3-month average, trend adjusted). Whatever's left goes to savings.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {suggestedNext.map((row, i) => {
                      const forecast = row.category_id ? forecastMap.get(row.category_id) || 0 : 0;
                      const scaled = forecast > 0 && Math.abs(forecast - row.amount) > 1;
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                          <span className="flex items-center gap-1.5 min-w-0 truncate">
                            {catIcon(row.category_id)} {row.label || catName(row.category_id)}
                            {catKind(row.category_id) && <Badge variant="secondary" className="text-[10px] capitalize">{catKind(row.category_id)}</Badge>}
                          </span>
                          <span className="text-right shrink-0">
                            <span className="font-medium">{fmtKES(row.amount)}</span>
                            {scaled && <span className="block text-[10px] text-muted-foreground">forecast {fmtKES(forecast)}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <PlanTemplates
            currentRows={rows.map((r) => ({ category_id: r.category_id, label: r.label, percent: r.percent, amount: r.amount }))}
            strategy={strategy}
            earnings={earnings}
            catLabel={catName}
            onApply={(items, mode) => {
              setStrategy(mode);
              setRows(items.map((i) => ({ category_id: i.category_id, label: i.label, percent: i.percent, amount: i.amount })));
              touch();
            }}
          />
        </TabsContent>

        {/* ---------------- HISTORY ---------------- */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <PlanTimeline categories={categories} refreshKey={refreshKey} onOpenMonth={setPeriod} />
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Your plans</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved plans yet — save this month's plan to start your history.</p>
              ) : plans.map((p) => (
                <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${p.period === period ? "border-primary" : ""}`}>
                  <div>
                    <div className="text-sm font-medium">{monthLabel(p.period)}</div>
                    <div className="text-xs text-muted-foreground">Earnings {fmtKES(Number(p.total_income))} · split by {p.strategy === "percent" ? "percentages" : "fixed amounts"}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setPeriod(p.period)}>Open</Button>
                    <Button size="sm" variant="ghost" onClick={() => removePlan(p.id, monthLabel(p.period))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar */}
      <div className="fixed bottom-16 md:bottom-4 left-0 right-0 px-4 z-30 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto rounded-full border bg-card/95 backdrop-blur shadow-lg px-4 py-2 flex items-center justify-between gap-3">
          <div className="text-xs min-w-0 truncate">
            <span className="font-semibold">{monthShort(period)}</span>{" · "}
            <span className={unallocated < 0 ? "text-danger" : "text-muted-foreground"}>
              {unallocated < 0 ? `over by ${fmtKES(Math.abs(unallocated))}` : `${fmtKES(unallocated)} free`}
            </span>
          </div>
          <Button size="sm" onClick={save} disabled={saving} className="rounded-full">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : dirty ? "Save changes" : "Save plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EnvelopeRow({
  row, strategy, earnings, planned, spent, icon, name, kind, forecast, expenseCats, onChange, onRemove,
}: any) {
  const [editing, setEditing] = useState(false);
  const remaining = planned - spent;
  const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : spent > 0 ? 100 : 0;

  return (
    <div className="rounded-xl border p-3 space-y-2 group">
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium truncate">{row.label || name}</span>
            {kind && <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{kind}</Badge>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Spent {fmtKES(spent)} ·{" "}
            <span className={remaining < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
              {remaining < 0 ? `over by ${fmtKES(Math.abs(remaining))}` : `${fmtKES(remaining)} left`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Input type="number" inputMode="decimal"
            value={strategy === "percent" ? row.percent || "" : row.amount || ""}
            onChange={(e) => onChange(strategy === "percent"
              ? { percent: Number(e.target.value) || 0 }
              : { amount: Number(e.target.value) || 0 })}
            className="h-9 w-24 text-right font-semibold"
            placeholder={strategy === "percent" ? "%" : "0"} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing((v) => !v)} aria-label="Edit envelope">
            {editing ? <Check className="h-4 w-4" /> : <span className="text-xs">⋯</span>}
          </Button>
        </div>
      </div>

      <Progress value={pct} className={remaining < 0 ? "[&>div]:bg-danger" : pct > 80 ? "[&>div]:bg-warning" : ""} />

      <div className="flex flex-wrap items-center gap-2">
        {strategy === "percent" && earnings > 0 && (
          <span className="text-[10px] text-muted-foreground">= {fmtKES(planned)}</span>
        )}
        {forecast > 0 && Math.round(forecast) !== Math.round(planned) && (
          <button type="button"
            onClick={() => onChange(strategy === "percent"
              ? { percent: earnings ? Math.round((forecast / earnings) * 1000) / 10 : 0 }
              : { amount: Math.round(forecast) })}
            className="text-[10px] text-primary hover:underline">
            Forecast {fmtKES(forecast)} — use it
          </button>
        )}
      </div>

      {editing && (
        <div className="grid gap-2 sm:grid-cols-2 pt-1 border-t">
          <div className="pt-2">
            <Label className="text-[11px]">Category</Label>
            <Select value={row.category_id || "none"} onValueChange={(value) => onChange({ category_id: value === "none" ? null : value })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No category —</SelectItem>
                {expenseCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2">
            <Label className="text-[11px]">Nickname</Label>
            <Input value={row.label} onChange={(e) => onChange({ label: e.target.value })}
              placeholder="e.g. Household run" className="h-9" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button size="sm" variant="ghost" className="text-danger" onClick={onRemove}>
              <X className="h-4 w-4 mr-1" /> Remove envelope
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
