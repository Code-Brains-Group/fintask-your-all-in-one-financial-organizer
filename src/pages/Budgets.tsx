import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const month = new Date().toISOString().slice(0, 7);

  const load = async () => {
    if (!user) return;
    const [b, i, t] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("budget_items").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("id, amount, fee, date, type, description").eq("user_id", user.id).eq("type", "expense"),
    ]);
    setBudgets(b.data || []); setItems(i.data || []); setTransactions(t.data || []);
  };
  useEffect(() => { load(); }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const monthBudgets = budgets.filter(b => {
    if (b.period_start && b.period_end) return b.period_start <= today && today <= b.period_end;
    return !b.month || b.month === month;
  });

  const itemsFor = (bid: string) => items.filter(x => x.budget_id === bid);
  const spent = (bid: string) => itemsFor(bid).filter(x => x.purchased && x.transaction_id)
    .reduce((a, x) => {
      const tx = transactions.find(t => t.id === x.transaction_id);
      return a + (tx ? Number(tx.amount) + Number(tx.fee || 0) : 0);
    }, 0);

  const removeBudget = async (id: string) => {
    if (!confirm("Delete budget and its items?")) return;
    await supabase.from("budget_items").delete().eq("budget_id", id);
    await supabase.from("budgets").delete().eq("id", id);
    toast.success("Budget deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Budgets & Plans</h1>
          <p className="text-muted-foreground text-sm">Plan what to buy this month and track against actual spend</p>
        </div>
        <NewBudget onSaved={load} />
      </div>

      {monthBudgets.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <div className="text-5xl mb-3">📊</div>
          <p className="text-muted-foreground">No budgets yet — create your first plan</p>
        </CardContent></Card>
      ) : monthBudgets.map(b => {
        const list = itemsFor(b.id);
        const planned = list.reduce((a, x) => a + Number(x.planned_amount), 0);
        const sp = spent(b.id);
        const limit = Number(b.monthly_limit) || planned;
        const pct = limit ? Math.min(100, (sp / limit) * 100) : 0;
        return (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{b.name || "Untitled budget"}</CardTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Limit {fmtKES(limit)} · Planned {fmtKES(planned)} · Spent {fmtKES(sp)}
                  {b.period_start && b.period_end && <> · {b.period_start} → {b.period_end}</>}
                  {b.recurrence && b.recurrence !== "once" && <> · {b.recurrence}{b.auto_renew ? " (auto-renew)" : ""}</>}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeBudget(b.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={pct} className={pct > 100 ? "[&>div]:bg-danger" : pct > 80 ? "[&>div]:bg-warning" : ""} />
              <BudgetItems budgetId={b.id} items={list} transactions={transactions} onChange={load} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function BudgetItems({ budgetId, items, transactions, onChange }: any) {
  const { user } = useAuth();
  const [name, setName] = useState(""); const [amount, setAmount] = useState("");

  const add = async () => {
    if (!name) return;
    await supabase.from("budget_items").insert({ user_id: user!.id, budget_id: budgetId, name, planned_amount: Number(amount || 0) });
    setName(""); setAmount(""); onChange();
  };
  const togglePurchased = async (item: any) => {
    await supabase.from("budget_items").update({ purchased: !item.purchased }).eq("id", item.id);
    onChange();
  };
  const linkTx = async (item: any, txId: string) => {
    await supabase.from("budget_items").update({ transaction_id: txId, purchased: true }).eq("id", item.id);
    onChange();
  };
  const remove = async (id: string) => { await supabase.from("budget_items").delete().eq("id", id); onChange(); };

  return (
    <div className="space-y-2">
      {items.map((it: any) => {
        const tx = transactions.find((t: any) => t.id === it.transaction_id);
        return (
          <div key={it.id} className="flex items-center gap-2 border rounded-lg p-2.5">
            <Checkbox checked={it.purchased} onCheckedChange={() => togglePurchased(it)} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${it.purchased ? "line-through text-muted-foreground" : ""}`}>{it.name}</div>
              {tx && <div className="text-xs text-muted-foreground">Linked: {tx.description} · {fmtKES(Number(tx.amount) + Number(tx.fee || 0))}</div>}
            </div>
            <div className="text-sm font-medium">{fmtKES(it.planned_amount)}</div>
            {!tx && (
              <select className="text-xs border rounded px-2 py-1 bg-background" defaultValue="" onChange={(e) => e.target.value && linkTx(it, e.target.value)}>
                <option value="">Link tx…</option>
                {transactions.slice(0, 50).map((t: any) => <option key={t.id} value={t.id}>{t.description} · {fmtKES(t.amount)}</option>)}
              </select>
            )}
            <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        );
      })}
      <div className="flex gap-2 pt-2 border-t">
        <Input placeholder="Item (e.g. Rice)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" placeholder="Amount" className="w-32" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function NewBudget({ onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [limit, setLimit] = useState("");
  const [recurrence, setRecurrence] = useState("monthly");
  const [autoRenew, setAutoRenew] = useState(true);
  const [useCustom, setUseCustom] = useState(false);
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState("");
  const month = new Date().toISOString().slice(0, 7);

  const computeEnd = (start: string, freq: string) => {
    const d = new Date(start);
    if (freq === "weekly") d.setDate(d.getDate() + 6);
    else if (freq === "yearly") { d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1); }
    else { d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); }
    return d.toISOString().slice(0, 10);
  };

  const submit = async () => {
    if (!name) return;
    const start = useCustom ? periodStart : new Date().toISOString().slice(0, 10);
    const end = useCustom ? (periodEnd || computeEnd(start, recurrence)) : computeEnd(start, recurrence);
    await supabase.from("budgets").insert({
      user_id: user!.id, name, monthly_limit: Number(limit || 0), month,
      period_start: start, period_end: end, recurrence, auto_renew: autoRenew,
    });
    setName(""); setLimit(""); setOpen(false); onSaved(); toast.success("Budget created");
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New budget</Button></SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>New budget plan</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly groceries" /></div>
          <div><Label>Limit (KES)</Label><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
          <div>
            <Label>Recurrence</Label>
            <select className="w-full border rounded-md h-10 px-3 bg-background" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="once">One-time</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={autoRenew} onCheckedChange={(v) => setAutoRenew(!!v)} />
            Auto-renew at end of period
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={useCustom} onCheckedChange={(v) => setUseCustom(!!v)} />
            Use custom start/end dates
          </label>
          {useCustom && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
              <div><Label className="text-xs">End</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
            </div>
          )}
          <Button className="w-full" onClick={submit}>Create budget</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
