import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Trash2, PiggyBank } from "lucide-react";
import { toast } from "sonner";

const REPO_TYPES = [
  { value: "bank", label: "🏦 Bank" },
  { value: "mmf", label: "📈 Money Market Fund (MMF)" },
  { value: "chama", label: "🤝 Chama" },
  { value: "sacco", label: "🏛️ SACCO" },
  { value: "cash", label: "💵 Cash" },
  { value: "mpesa", label: "📱 M-Pesa" },
  { value: "other", label: "💼 Other" },
];

export default function Savings() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const [g, c, w, gr] = await Promise.all([
      supabase.from("savings_goals").select("*"),
      supabase.from("savings_contributions").select("*"),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("groups").select("id,name,emoji"),
    ]);
    setGoals(g.data || []); setContribs(c.data || []); setWallets(w.data || []); setGroups(gr.data || []);
  };
  useEffect(() => { load(); }, [user]);

  const savedFor = (gid: string) => contribs.filter(c => c.goal_id === gid).reduce((a, c) => a + Number(c.amount), 0);
  const groupOf = (id: string | null) => id ? groups.find(g => g.id === id) : null;

  const remove = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    await supabase.from("savings_contributions").delete().eq("goal_id", id);
    await supabase.from("savings_goals").delete().eq("id", id);
    load(); toast.success("Goal deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Savings & Repositories</h1>
          <p className="text-muted-foreground text-sm">Track money saved across Banks, MMFs, Chamas etc.</p>
        </div>
        <NewGoal wallets={wallets} groups={groups} onSaved={load} />
      </div>

      {goals.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No savings goals yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map(g => {
            const saved = savedFor(g.id);
            const pct = Math.min(100, (saved / Number(g.target_amount)) * 100);
            return (
              <Card key={g.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{g.icon} {g.name}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {REPO_TYPES.find(r => r.value === g.repository_type)?.label || "Repository"}
                      {g.deadline && ` · By ${fmtDate(g.deadline)}`}
                      {groupOf(g.group_id) && ` · 👥 ${groupOf(g.group_id)!.name}`}
                    </div>
                  </div>
                  {g.user_id === user?.id && <Button size="icon" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></Button>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{fmtKES(saved)}</span>
                    <span className="text-muted-foreground">of {fmtKES(g.target_amount)}</span>
                  </div>
                  <Progress value={pct} />
                  <Contribute goal={g} wallets={wallets} onSaved={load} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Contribute({ goal, wallets, onSaved }: any) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(""); const [walletId, setWalletId] = useState("");
  const add = async () => {
    if (!amount) return;
    await supabase.from("savings_contributions").insert({
      user_id: user!.id, goal_id: goal.id, amount: Number(amount), wallet_id: walletId || null,
    });
    setAmount(""); onSaved(); toast.success("Contribution added");
  };
  return (
    <div className="flex gap-2 pt-2 border-t">
      <Input type="number" placeholder="Add amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1" />
      <Select value={walletId} onValueChange={setWalletId}>
        <SelectTrigger className="w-32"><SelectValue placeholder="Wallet" /></SelectTrigger>
        <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="icon" onClick={add}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}

function NewGoal({ wallets, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("🎯"); const [deadline, setDeadline] = useState("");
  const [repoType, setRepoType] = useState("bank");

  const submit = async () => {
    if (!name || !target) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.from("savings_goals").insert({
      user_id: user!.id, name, target_amount: Number(target), icon,
      deadline: deadline || null, repository_type: repoType,
    } as any);
    if (error) { toast.error(error.message); return; }
    setName(""); setTarget(""); setDeadline(""); setOpen(false); onSaved(); toast.success("Goal created");
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New goal</Button></SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>New savings goal</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="flex gap-2">
            <Input className="w-16" value={icon} onChange={(e) => setIcon(e.target.value)} />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" />
          </div>
          <div><Label>Repository type</Label>
            <Select value={repoType} onValueChange={setRepoType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPO_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Target amount (KES)</Label><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div><Label>Deadline (optional)</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          <Button className="w-full" onClick={submit}>Create goal</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
