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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2, Wand2, Wallet, PiggyBank, AlertTriangle, Copy, Sparkles, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import PlanTemplates from "@/components/planner/PlanTemplates";
import PlanTimeline from "@/components/planner/PlanTimeline";


type Row = { id?: string; category_id: string | null; label: string; percent: number; amount: number };
type PlanRow = { id: string; period: string; total_income: number; strategy: string };

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

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

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));

  const addRow = () => setRows((current) => [...current, { category_id: null, label: "", percent: 0, amount: 0 }]);
  const removeRow = (index: number) => setRows((current) => current.filter((_, i) => i !== index));

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
   * same number), with anything left over parked in savings. If the forecast
   * is bigger than expected earnings we scale every envelope down evenly and
   * say so, instead of inventing 50/30/20 numbers nobody recognises.
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
    toast.success("Applied your forecast — same numbers as the Insights page");
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
    if (!preset.length) { toast.error("Tag a few categories as need/want first in Settings"); return; }
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financial planner</h1>
          <p className="text-muted-foreground text-sm">
            Plan any month, split earnings into envelopes, and let your spending forecast do the first draft.
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">Month</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
          </div>
          {planId && <Button variant="outline" size="icon" onClick={() => removePlan()}><Trash2 className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={() => copyTo(nextPeriod)}><Copy className="h-4 w-4 mr-1" /> Copy to next month</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save plan"}</Button>
        </div>
      </div>

      {/* Step 1 — earnings */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <Label>1. Expected earnings for {monthLabel(period)}</Label>
              <Input type="number" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 60000" className="text-lg font-semibold" />
              {forecastIncomeAvg > 0 && !earnings && (
                <button type="button" onClick={() => setIncome(String(Math.round(forecastIncomeAvg)))}
                  className="text-xs text-primary hover:underline mt-1">
                  Use your 3-month average income ({fmtKES(forecastIncomeAvg)})
                </button>
              )}
            </div>
            <div>
              <Label className="text-xs">Split by</Label>
              <div className="flex gap-1 rounded-lg border p-1">
                {(["amount", "percent"] as const).map((mode) => (
                  <Button key={mode} size="sm" variant={strategy === mode ? "default" : "ghost"} className="capitalize" onClick={() => setStrategy(mode)}>
                    {mode === "amount" ? "Fixed amounts" : "Percentages"}
                  </Button>
                ))}
              </div>
            </div>
            <Button onClick={applyRule}><Wand2 className="h-4 w-4 mr-1" /> Draft from my forecast</Button>
          </div>

          {forecastSpend > 0 && (
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-medium text-foreground">Your forecast (same as Insights &amp; Reports):</span>
              <span>Predicted spend {fmtKES(forecastSpend)}</span>
              <span>Avg income {fmtKES(forecastIncomeAvg)}</span>
              {earnings > 0 && forecastSpend > earnings && (
                <span className="text-danger">Forecast exceeds your earnings — envelopes get scaled down evenly.</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Earnings" value={fmtKES(earnings)} icon={Wallet} />
        <Stat label="Allocated" value={fmtKES(allocated)} icon={PiggyBank} tone={allocated > earnings ? "danger" : "default"} />
        <Stat label="Unallocated" value={fmtKES(unallocated)} tone={unallocated < 0 ? "danger" : "success"} />
        <Stat label="Left from earnings" value={fmtKES(leftFromEarnings)} tone={leftFromEarnings < 0 ? "danger" : "success"} />
      </div>

      {rows.length > 0 && earnings > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Needs vs wants vs savings</div>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            <div className="bg-primary" style={{ width: `${Math.min(100, (needTotal / earnings) * 100)}%` }} />
            <div className="bg-warning" style={{ width: `${Math.min(100, (wantTotal / earnings) * 100)}%` }} />
            <div className="bg-success" style={{ width: `${Math.min(100, (saveTotal / earnings) * 100)}%` }} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Needs {fmtKES(needTotal)} ({Math.round((needTotal / earnings) * 100)}%)</span>
            <span>Wants {fmtKES(wantTotal)} ({Math.round((wantTotal / earnings) * 100)}%)</span>
            <span>Savings {fmtKES(saveTotal)} ({Math.round((saveTotal / earnings) * 100)}%)</span>
          </div>
        </CardContent></Card>
      )}

      {overspentRows.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-danger mt-0.5" />
          <div>
            <span className="font-medium text-danger">{overspentRows.length} envelope{overspentRows.length > 1 ? "s are" : " is"} in the red.</span>{" "}
            {overspentRows.map((row) => row.label || catName(row.category_id)).join(", ")} — spending here now eats into other plans.
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Envelopes</CardTitle>
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add envelope</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)
            : rows.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🧧</div>
                <p className="text-muted-foreground mb-4">No envelopes yet — split your earnings into categories like Food, Rent or Savings.</p>
                <Button onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add your first envelope</Button>
              </div>
            ) : rows.map((row, index) => {
              const planned = plannedFor(row);
              const spent = spentFor(row);
              const remaining = planned - spent;
              const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : spent > 0 ? 100 : 0;
              const kind = catKind(row.category_id);
              return (
                <div key={row.id || index} className="rounded-xl border p-3 space-y-3">
                  <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select value={row.category_id || "none"} onValueChange={(value) => setRow(index, { category_id: value === "none" ? null : value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— No category (e.g. savings) —</SelectItem>
                          {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{strategy === "percent" ? "Share of earnings (%)" : "Amount (KES)"}</Label>
                      <Input type="number" inputMode="decimal"
                        value={strategy === "percent" ? row.percent || "" : row.amount || ""}
                        onChange={(e) => setRow(index, strategy === "percent"
                          ? { percent: Number(e.target.value) || 0 }
                          : { amount: Number(e.target.value) || 0 })} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input value={row.label} onChange={(e) => setRow(index, { label: e.target.value })} placeholder="Nickname (optional) e.g. Household run" className="h-8 text-xs" />
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        {catIcon(row.category_id)} {row.label || catName(row.category_id)}
                        {kind && <Badge variant="secondary" className="text-[10px] capitalize">{kind}</Badge>}
                      </span>
                      <span className="text-muted-foreground">
                        Planned {fmtKES(planned)} · Spent {fmtKES(spent)} ·{" "}
                        <span className={remaining < 0 ? "text-danger font-semibold" : "text-success font-semibold"}>
                          {remaining < 0 ? `Over by ${fmtKES(Math.abs(remaining))}` : `${fmtKES(remaining)} left`}
                        </span>
                      </span>
                    </div>
                    <Progress value={pct} className={remaining < 0 ? "[&>div]:bg-danger" : pct > 80 ? "[&>div]:bg-warning" : ""} />
                    {remaining < 0 && <Badge variant="destructive" className="text-[10px]">Envelope in the red</Badge>}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Suggested plan for {monthLabel(nextPeriod)}</CardTitle>
          {!nextPlanExists && <Button size="sm" onClick={draftSuggestionForNext}>Create this plan</Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {nextPlanExists ? (
            <p className="text-sm text-muted-foreground">You already have a plan for {monthLabel(nextPeriod)} — open it from the list below.</p>
          ) : suggestedNext.length === 0 ? (
            <p className="text-sm text-muted-foreground">Enter your expected earnings and tag categories as need/want in Settings to get a suggestion.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Based on 50% needs / 30% wants / 20% savings, weighted by your last 3 months of spending.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestedNext.map((row, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span className="flex items-center gap-1.5">{catIcon(row.category_id)} {row.label || catName(row.category_id)}
                      {catKind(row.category_id) && <Badge variant="secondary" className="text-[10px] capitalize">{catKind(row.category_id)}</Badge>}
                    </span>
                    <span className="font-medium">{fmtKES(row.amount)}</span>
                  </div>
                ))}
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
        }}
      />

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
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = "default" }: any) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</div>
    </CardContent></Card>
  );
}
