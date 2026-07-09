import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Wallet, Receipt, CheckCircle2, Plus, Repeat, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import ReportRenderer from "@/components/reports/ReportRenderer";

const COLORS = ["#0175C2", "#34A853", "#F4A900", "#EA4335", "#7B61FF", "#00B8D9", "#FF6B6B", "#9333EA"];

type Tx = any;

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  const loadAll = async () => {
    if (!user) return;
    const [tx, w, c, t, ta, g, sc, p, r] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(500),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("tasks").select("*").eq("user_id", user.id).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(3),
      supabase.from("tasks").select("*").eq("user_id", user.id),
      supabase.from("savings_goals").select("*").eq("user_id", user.id).eq("completed", false),
      supabase.from("savings_contributions").select("*").eq("user_id", user.id),
      supabase.from("pending_recurring").select("*").eq("user_id", user.id).eq("status", "pending"),
      supabase.from("recurring_rules").select("*").eq("user_id", user.id),
    ]);
    setTransactions(tx.data || []);
    setWallets(w.data || []);
    setCategories(c.data || []);
    setTasks(t.data || []);
    setAllTasks(ta.data || []);
    setGoals(g.data || []);
    setContributions(sc.data || []);
    const rulesList = r.data || [];
    const ruleIds = new Set(rulesList.map((x: any) => x.id));
    // Only show pending entries whose rule still exists (avoids "phantom" count)
    setPending((p.data || []).filter((x: any) => ruleIds.has(x.rule_id)));
    setRules(rulesList);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user]);

  const ruleFor = (id: string) => rules.find(r => r.id === id);
  const approve = async (p: any) => {
    const r = ruleFor(p.rule_id); if (!r) return;
    await supabase.from("transactions").insert({
      user_id: user!.id, description: r.description, amount: Number(r.amount), type: r.type,
      category_id: r.category_id, wallet_id: r.wallet_id, date: p.due_date,
      method: r.method || "direct", recurring_rule_id: r.id, task_id: r.task_id || null,
    });
    await supabase.from("pending_recurring").update({ status: "approved" }).eq("id", p.id);
    toast.success("Approved & added"); loadAll();
  };
  const skip = async (p: any) => {
    await supabase.from("pending_recurring").update({ status: "skipped" }).eq("id", p.id);
    loadAll();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map(i => <div key={i} className="skeleton h-28" />)}</div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="skeleton h-72 lg:col-span-2" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTx = transactions.filter(t => new Date(t.date) >= monthStart);
  const income = monthTx.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const expense = monthTx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const fees = monthTx.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.fee || 0), 0);

  const walletBalance = (id: string) => {
    const w = wallets.find(x => x.id === id);
    if (!w) return 0;
    let bal = Number(w.opening_balance);
    transactions.forEach(t => {
      if (t.wallet_id === id) {
        if (t.type === "income") bal += Number(t.amount);
        else if (t.type === "expense") bal -= Number(t.amount) + Number(t.fee || 0);
        else if (t.type === "transfer") bal -= Number(t.amount) + Number(t.fee || 0);
      }
      if (t.to_wallet_id === id && t.type === "transfer") bal += Number(t.amount);
    });
    return bal;
  };
  const totalBalance = wallets.reduce((a, w) => a + walletBalance(w.id), 0);

  // Net worth line — last 6 months
  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    let v = wallets.reduce((a, w) => a + Number(w.opening_balance), 0);
    transactions.forEach(t => {
      if (new Date(t.date) > end) return;
      if (t.type === "income") v += Number(t.amount);
      else if (t.type === "expense") v -= Number(t.amount) + Number(t.fee || 0);
      else if (t.type === "transfer") v -= Number(t.fee || 0);
    });
    months.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), value: v });
  }

  // Spending by category
  const spendByCat = categories.map(c => ({
    name: `${c.icon} ${c.name}`,
    value: monthTx.filter(t => t.type === "expense" && t.category_id === c.id).reduce((a, t) => a + Number(t.amount), 0),
  })).filter(d => d.value > 0);

  // Income vs Expense bars
  const ieBars = months.map((m, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - 5 + i + 1, 0, 23, 59, 59);
    const inMo = transactions.filter(t => new Date(t.date) >= d && new Date(t.date) <= end);
    return {
      label: m.label,
      Income: inMo.filter(t => t.type === "income").reduce((a, t) => a + Number(t.amount), 0),
      Expense: inMo.filter(t => t.type === "expense").reduce((a, t) => a + Number(t.amount) + Number(t.fee || 0), 0),
    };
  });

  const recent = transactions.slice(0, 5);
  const catName = (id: string) => categories.find(c => c.id === id)?.name || "—";
  const catIcon = (id: string) => categories.find(c => c.id === id)?.icon || "💰";
  const walletName = (id: string) => wallets.find(w => w.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Here's your financial snapshot</p>
        </div>
        <Button asChild><Link to="/finance/transactions"><Plus className="h-4 w-4 mr-1" /> Add transaction</Link></Button>
      </div>

      {pending.length > 0 && (
        <Card className="border-warning/50 bg-warning-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-warning flex items-center gap-2">
              <Repeat className="h-4 w-4" /> Recurring approvals pending ({pending.length})
            </CardTitle>
            <Link to="/finance/recurring" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.slice(0, 3).map(p => {
              const r = ruleFor(p.rule_id); if (!r) return null;
              return (
                <div key={p.id} className="flex items-center gap-3 bg-card border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.description} · {fmtKES(r.amount)}</div>
                    <div className="text-xs text-muted-foreground">Due {fmtDate(p.due_date)}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => skip(p)}><X className="h-4 w-4 mr-1"/>Skip</Button>
                  <Button size="sm" onClick={() => approve(p)}><Check className="h-4 w-4 mr-1"/>Approve</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Balance" value={fmtKES(totalBalance)} icon={Wallet} tone="primary" />
        <StatCard label="Income (this month)" value={fmtKES(income)} icon={TrendingUp} tone="success" />
        <StatCard label="Expenses (this month)" value={fmtKES(expense)} icon={TrendingDown} tone="danger" />
        <StatCard label="Transaction Costs" value={fmtKES(fees)} icon={Receipt} tone="warning" />
      </div>

      {/* Task spend insights */}
      {(() => {
        const taskTx = transactions.filter(t => t.task_id);
        if (taskTx.length === 0) return null;
        const totalSpent = taskTx.reduce((a, t) => a + Number(t.amount) + Number(t.fee || 0), 0);
        const totalBudget = allTasks.reduce((a, t) => a + Number(t.planned_cost || 0), 0);
        const overBudget = allTasks.filter(t => {
          const spent = taskTx.filter(x => x.task_id === t.id).reduce((a, x) => a + Number(x.amount) + Number(x.fee || 0), 0);
          return Number(t.planned_cost || 0) > 0 && spent > Number(t.planned_cost);
        }).length;
        return (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Spent on tasks" value={fmtKES(totalSpent)} icon={Receipt} tone="warning" />
            <StatCard label="Task budgets" value={fmtKES(totalBudget)} icon={Wallet} tone="primary" />
            <StatCard label="Over budget" value={String(overBudget)} icon={TrendingDown} tone="danger" />
          </div>
        );
      })()}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Net Worth — Last 6 months</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Spending by Category</CardTitle></CardHeader>
          <CardContent className="h-72">
            {spendByCat.length === 0 ? <Empty msg="No expenses yet this month" /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={spendByCat} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {spendByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtKES(v as number)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Income vs Expenses</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={ieBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip formatter={(v: any) => fmtKES(v as number)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="Income" fill="hsl(var(--success))" radius={[6,6,0,0]} />
              <Bar dataKey="Expense" fill="hsl(var(--danger))" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Wallets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {wallets.length === 0 && <Empty msg="No wallets yet" />}
            {wallets.map(w => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm">{w.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{w.type}</div>
                </div>
                <div className="font-semibold">{fmtKES(walletBalance(w.id))}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link to="/finance/transactions" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? <Empty msg="No transactions yet" /> : (
              <div className="divide-y">
                {recent.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-lg">{catIcon(t.category_id)}</div>
                      <div>
                        <div className="text-sm font-medium">{t.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {catName(t.category_id)} · {walletName(t.wallet_id)} · {fmtDate(t.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-foreground"}`}>
                        {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{fmtKES(t.amount)}
                      </div>
                      {Number(t.fee) > 0 && <Badge variant="outline" className="text-xs mt-1">Fee {fmtKES(t.fee)}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming Tasks</CardTitle>
            <Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? <Empty msg="No upcoming tasks" /> : tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.due_date ? fmtDate(t.due_date) : "No due date"}</div>
                  </div>
                </div>
                <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"}>{t.priority}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Savings Goals</CardTitle>
            <Link to="/finance/savings" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.length === 0 ? <Empty msg="No active goals" /> : goals.slice(0, 4).map(g => {
              const saved = contributions.filter(c => c.goal_id === g.id).reduce((a, c) => a + Number(c.amount), 0);
              const pct = Math.min(100, (saved / Number(g.target_amount)) * 100);
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{g.icon} {g.name}</span>
                    <span className="text-muted-foreground">{fmtKES(saved)} / {fmtKES(g.target_amount)}</span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  }[tone] || "bg-muted text-foreground";
  return (
    <div className="ft-stat">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`h-9 w-9 rounded-lg grid place-items-center ${toneClass}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center text-sm text-muted-foreground py-8">{msg}</div>;
}
