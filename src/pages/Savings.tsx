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
import { Plus, Trash2, PiggyBank, Settings2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_REPO_TYPES = [
  { value: "bank", label: "🏦 Bank" },
  { value: "mmf", label: "📈 Money Market Fund (MMF)" },
  { value: "chama", label: "🤝 Chama" },
  { value: "sacco", label: "🏛️ SACCO" },
  { value: "cash", label: "💵 Cash" },
  { value: "mpesa", label: "📱 M-Pesa" },
  { value: "other", label: "💼 Other" },
];

type Repo = { value: string; label: string };

export default function Savings() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [customRepos, setCustomRepos] = useState<Repo[]>([]);

  const load = async () => {
    if (!user) return;
    const [g, c, w, gr, p] = await Promise.all([
      supabase.from("savings_goals").select("*"),
      supabase.from("savings_contributions").select("*"),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("groups").select("id,name,emoji"),
      supabase.from("profiles").select("custom_repos").eq("id", user.id).maybeSingle(),
    ]);
    setGoals(g.data || []); setContribs(c.data || []); setWallets(w.data || []); setGroups(gr.data || []);
    setCustomRepos(((p.data as any)?.custom_repos as Repo[]) || []);
  };
  useEffect(() => { load(); }, [user]);

  const allRepos: Repo[] = [...DEFAULT_REPO_TYPES, ...customRepos];
  const repoLabel = (v: string) => allRepos.find(r => r.value === v)?.label || "Repository";

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
        <div className="flex gap-2">
          <ManageRepos custom={customRepos} onChange={load} />
          <NewGoal wallets={wallets} groups={groups} repos={allRepos} onSaved={load} />
        </div>
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
                      {repoLabel(g.repository_type)}
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
      group_id: goal.group_id || null,
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

function ManageRepos({ custom, onChange }: { custom: Repo[]; onChange: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState("💼");
  const [name, setName] = useState("");

  const save = async (next: Repo[]) => {
    const { error } = await supabase.from("profiles").update({ custom_repos: next as any }).eq("id", user!.id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };
  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Enter a name"); return; }
    const value = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) + "_" + Date.now().toString(36).slice(-4);
    await save([...custom, { value, label: `${icon} ${trimmed}` }]);
    setName(""); setIcon("💼"); toast.success("Repository type added");
  };
  const remove = async (value: string) => {
    if (!confirm("Remove this repository type? Existing goals keep their label.")) return;
    await save(custom.filter(r => r.value !== value));
    toast.success("Removed");
  };
  const saveEdit = async (value: string, nextIcon: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) { toast.error("Name required"); return; }
    await save(custom.map(r => r.value === value ? { ...r, label: `${nextIcon || "💼"} ${trimmed}` } : r));
    toast.success("Updated");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline"><Settings2 className="h-4 w-4 mr-1" /> Repository types</Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Manage repository types</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label className="text-xs text-muted-foreground">Built-in</Label>
            <div className="mt-1 space-y-1">
              {DEFAULT_REPO_TYPES.map(r => (
                <div key={r.value} className="text-sm px-3 py-2 rounded-md bg-muted/40">{r.label}</div>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Your custom types</Label>
            {custom.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">None yet — add one below.</p>
            ) : (
              <div className="mt-1 space-y-1">
                {custom.map(r => <RepoRow key={r.value} repo={r} onSave={saveEdit} onDelete={remove} />)}
              </div>
            )}
          </div>
          <div className="pt-3 border-t space-y-2">
            <Label>Add new</Label>
            <div className="flex gap-2">
              <Input className="w-16" value={icon} onChange={(e) => setIcon(e.target.value)} />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crypto wallet, Fixed deposit" />
            </div>
            <Button className="w-full" onClick={add}><Plus className="h-4 w-4 mr-1" /> Add repository type</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NewGoal({ wallets, groups, repos, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("🎯"); const [deadline, setDeadline] = useState("");
  const [repoType, setRepoType] = useState("bank");
  const [groupId, setGroupId] = useState<string>("none");

  const submit = async () => {
    if (!name || !target) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.from("savings_goals").insert({
      user_id: user!.id, name, target_amount: Number(target), icon,
      deadline: deadline || null, repository_type: repoType,
      group_id: groupId === "none" ? null : groupId,
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
              <SelectContent>{repos.map((r: Repo) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Target amount (KES)</Label><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div><Label>Deadline (optional)</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
          <div><Label>Share with group (optional)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Personal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">🔒 Personal</SelectItem>
                {(groups || []).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.emoji || "👥"} {g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Group goals appear in the group leaderboard.</p>
          </div>
          <Button className="w-full" onClick={submit}>Create goal</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
