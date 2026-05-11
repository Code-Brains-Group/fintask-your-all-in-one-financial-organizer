import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate, METHOD_LABELS } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, X, Repeat } from "lucide-react";
import { toast } from "sonner";

function nextDate(date: Date, freq: string, align?: { day?: number; month?: number }): Date {
  const d = new Date(date);
  if (freq === "weekly") { d.setDate(d.getDate() + 7); return d; }
  if (freq === "monthly") {
    d.setMonth(d.getMonth() + 1);
    if (align?.day) d.setDate(Math.min(28, align.day));
    return d;
  }
  if (freq === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
    if (align?.month) d.setMonth(align.month - 1);
    if (align?.day) d.setDate(Math.min(28, align.day));
    return d;
  }
  return d;
}

export default function Recurring() {
  const { user, fiscal } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskSpend, setTaskSpend] = useState<Record<string, number>>({});

  const load = async () => {
    if (!user) return;
    const [r, p, w, c, t, tx] = await Promise.all([
      supabase.from("recurring_rules").select("*").eq("user_id", user.id).order("next_due"),
      supabase.from("pending_recurring").select("*").eq("user_id", user.id).eq("status", "pending"),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("tasks").select("id,title,planned_cost,status").eq("user_id", user.id),
      supabase.from("transactions").select("task_id,amount,fee").eq("user_id", user.id).not("task_id", "is", null),
    ]);
    setRules(r.data || []); setPending(p.data || []); setWallets(w.data || []); setCategories(c.data || []);
    setTasks(t.data || []);
    const spend: Record<string, number> = {};
    (tx.data || []).forEach((x: any) => { spend[x.task_id] = (spend[x.task_id] || 0) + Number(x.amount) + Number(x.fee || 0); });
    setTaskSpend(spend);
  };
  useEffect(() => { load(); }, [user]);

  // Generate pending entries when rule's next_due <= today
  useEffect(() => {
    if (!user || !rules.length) return;
    const today = new Date(); today.setHours(0,0,0,0);
    (async () => {
      for (const r of rules) {
        if (!r.active) continue;
        let due = new Date(r.next_due);
        while (due <= today) {
          const exists = pending.find(p => p.rule_id === r.id && p.due_date === due.toISOString().slice(0,10));
          if (!exists) {
            await supabase.from("pending_recurring").insert({ user_id: user.id, rule_id: r.id, due_date: due.toISOString().slice(0,10) });
          }
          due = nextDate(due, r.frequency, r.align_fiscal ? { day: fiscal.monthStartDay, month: fiscal.yearStartMonth } : undefined);
          if (r.until_date && due > new Date(r.until_date)) break;
        }
        if (due.toISOString().slice(0,10) !== r.next_due) {
          await supabase.from("recurring_rules").update({ next_due: due.toISOString().slice(0,10) }).eq("id", r.id);
        }
      }
      load();
    })();
  }, [rules.length, user]);

  const ruleFor = (id: string) => rules.find(r => r.id === id);
  const walletName = (id: string) => wallets.find(w => w.id === id)?.name || "—";
  const catName = (id: string) => categories.find(c => c.id === id)?.name || "—";

  const approve = async (p: any) => {
    const r = ruleFor(p.rule_id); if (!r) return;
    await supabase.from("transactions").insert({
      user_id: user!.id, description: r.description, amount: Number(r.amount), type: r.type,
      category_id: r.category_id, wallet_id: r.wallet_id, date: p.due_date,
      method: r.method || "direct", recurring_rule_id: r.id, task_id: r.task_id || null,
    });
    await supabase.from("pending_recurring").update({ status: "approved" }).eq("id", p.id);
    toast.success("Approved & added"); load();
  };
  const skip = async (p: any) => {
    await supabase.from("pending_recurring").update({ status: "skipped" }).eq("id", p.id);
    load();
  };
  const removeRule = async (id: string) => {
    if (!confirm("Delete this recurring rule?")) return;
    await supabase.from("recurring_rules").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recurring Transactions</h1>
          <p className="text-muted-foreground text-sm">Auto-generate rent, transport, shopping etc. — approve when due</p>
        </div>
        <NewRule wallets={wallets} categories={categories} tasks={tasks} onSaved={load} />
      </div>

      {pending.length > 0 && (
        <Card className="border-warning/50 bg-warning-soft">
          <CardHeader><CardTitle className="text-base text-warning">⏰ Pending approvals ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map(p => {
              const r = ruleFor(p.rule_id); if (!r) return null;
              const task = r.task_id ? tasks.find(t => t.id === r.task_id) : null;
              return (
                <div key={p.id} className="flex items-center gap-3 bg-card border rounded-lg p-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{r.description} · {fmtKES(r.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      Due {fmtDate(p.due_date)} · {walletName(r.wallet_id)}
                      {task && <> · 🎯 <span className="text-primary">{task.title}</span></>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => skip(p)}><X className="h-4 w-4 mr-1"/>Skip</Button>
                  <Button size="sm" onClick={() => approve(p)}><Check className="h-4 w-4 mr-1"/>Approve</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Rules</CardTitle></CardHeader>
        <CardContent>
          {rules.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No recurring rules yet</div> : (
            <div className="space-y-2">
              {rules.map(r => {
                const task = r.task_id ? tasks.find(t => t.id === r.task_id) : null;
                const spent = task ? (taskSpend[task.id] || 0) : 0;
                const budget = task ? Number(task.planned_cost || 0) : 0;
                return (
                  <div key={r.id} className="flex items-center gap-3 border rounded-lg p-3 flex-wrap">
                    <Repeat className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{r.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtKES(r.amount)} · {r.frequency} · {catName(r.category_id)} · Next: {fmtDate(r.next_due)}
                      </div>
                      {task && (
                        <div className="text-xs mt-1">
                          🎯 <span className="text-primary font-medium">{task.title}</span>
                          {budget > 0 && <span className={spent > budget ? "text-danger ml-2" : "text-muted-foreground ml-2"}>
                            · Spent {fmtKES(spent)} / {fmtKES(budget)}
                          </span>}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize">{r.type}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => removeRule(r.id)}><Trash2 className="h-4 w-4" /></Button>
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

function NewRule({ wallets, categories, tasks, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [frequency, setFrequency] = useState("monthly");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [method, setMethod] = useState("direct");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = async () => {
    if (!description || !amount || !walletId) { toast.error("Fill required fields"); return; }
    await supabase.from("recurring_rules").insert({
      user_id: user!.id, description, amount: Number(amount), type, frequency,
      wallet_id: walletId, category_id: categoryId || null, task_id: taskId || null,
      method, start_date: startDate, next_due: startDate,
    });
    setDescription(""); setAmount(""); setTaskId(""); setOpen(false); onSaved(); toast.success("Recurring rule created");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New recurring</Button></SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>New recurring transaction</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Rent" /></div>
          <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Wallet</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.filter((c:any) => c.type === type).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Link to task (optional)</Label>
            <Select value={taskId || "__none"} onValueChange={(v) => setTaskId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No task" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No task</SelectItem>
                {tasks?.filter((t:any) => t.status !== "done").map((t: any) => <SelectItem key={t.id} value={t.id}>🎯 {t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <Button className="w-full" onClick={submit}>Create rule</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
