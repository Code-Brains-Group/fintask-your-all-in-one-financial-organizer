import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2, Wand2, Wallet, PiggyBank, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Row = { id?: string; category_id: string | null; label: string; percent: number; amount: number };

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default function Planner() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [planId, setPlanId] = useState<string | null>(null);
  const [income, setIncome] = useState("");
  const [strategy, setStrategy] = useState<"amount" | "percent">("amount");
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const start = `${period}-01`;
  const end = useMemo(() => {
    const d = new Date(`${period}-01T00:00:00`);
    d.setMonth(d.getMonth() + 1); d.setDate(0);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [plan, cats, tx] = await Promise.all([
      supabase.from("income_plans").select("*").eq("user_id", user.id).eq("period", period).maybeSingle(),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("id, amount, fee, type, category_id, date, description")
        .eq("user_id", user.id).gte("date", start).lte("date", end),
    ]);
    setCategories(cats.data || []);
    setTxs(tx.data || []);
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
  };

  useEffect(() => { load(); }, [user, period]);

  const earnings = Number(income) || 0;
  const expenseCats = categories.filter((c) => c.type === "expense");
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Unassigned";
  const catIcon = (id: string | null) => categories.find((c) => c.id === id)?.icon || "🧾";

  const plannedFor = (row: Row) => strategy === "percent" ? (earnings * (row.percent || 0)) / 100 : row.amount || 0;
  const spentFor = (row: Row) => txs
    .filter((t) => t.type === "expense" && t.category_id && t.category_id === row.category_id)
    .reduce((sum, t) => sum + Number(t.amount) + Number(t.fee || 0), 0);

  const allocated = rows.reduce((sum, row) => sum + plannedFor(row), 0);
  const unallocated = earnings - allocated;
  const totalSpent = txs.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount) + Number(t.fee || 0), 0);
  const leftFromEarnings = earnings - totalSpent;
  const overspentRows = rows.filter((row) => spentFor(row) > plannedFor(row));

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));

  const addRow = () => setRows((current) => [...current, { category_id: null, label: "", percent: 0, amount: 0 }]);
  const removeRow = (index: number) => setRows((current) => current.filter((_, i) => i !== index));

  const applyRule = () => {
    if (!earnings) { toast.error("Enter your expected earnings first"); return; }
    const pick = (pattern: RegExp) => expenseCats.find((c) => pattern.test(c.name))?.id || null;
    const preset: Row[] = [
      { category_id: pick(/food|grocer/i), label: "Needs — food & groceries", percent: 30, amount: earnings * 0.3 },
      { category_id: pick(/rent|hous|bill|utilit/i), label: "Needs — rent & bills", percent: 20, amount: earnings * 0.2 },
      { category_id: pick(/transport|fuel/i), label: "Transport", percent: 10, amount: earnings * 0.1 },
      { category_id: pick(/entertain|fun|shop/i), label: "Wants", percent: 20, amount: earnings * 0.2 },
      { category_id: null, label: "Savings & investments", percent: 20, amount: earnings * 0.2 },
    ];
    setRows(preset);
    toast.success("50/30/20 style plan applied — tweak it as you like");
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
    load();
  };

  const removePlan = async () => {
    if (!planId) return;
    if (!confirm(`Delete the plan for ${monthLabel(period)}?`)) return;
    await supabase.from("income_plans").delete().eq("id", planId);
    toast.success("Plan deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financial planner</h1>
          <p className="text-muted-foreground text-sm">Set what you expect to earn, share it across envelopes, and watch each one drain as you spend.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Month</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
          </div>
          {planId && <Button variant="outline" size="icon" onClick={removePlan}><Trash2 className="h-4 w-4" /></Button>}
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save plan"}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <Label>Expected earnings for {monthLabel(period)}</Label>
            <Input type="number" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 60000" className="text-lg font-semibold" />
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
          <Button variant="outline" onClick={applyRule}><Wand2 className="h-4 w-4 mr-1" /> Suggest a split</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Earnings" value={fmtKES(earnings)} icon={Wallet} />
        <Stat label="Allocated" value={fmtKES(allocated)} icon={PiggyBank} tone={allocated > earnings ? "danger" : "default"} />
        <Stat label="Unallocated" value={fmtKES(unallocated)} tone={unallocated < 0 ? "danger" : "success"} />
        <Stat label="Left from earnings" value={fmtKES(leftFromEarnings)} tone={leftFromEarnings < 0 ? "danger" : "success"} />
      </div>

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
                      <span className="font-medium">{catIcon(row.category_id)} {row.label || catName(row.category_id)}</span>
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
