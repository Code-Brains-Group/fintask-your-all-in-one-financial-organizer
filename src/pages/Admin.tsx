import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Shield, ShieldOff, Crown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtKES } from "@/lib/finance";
import { Navigate } from "react-router-dom";

const MODULES = ["finance","tasks","applications"];
const TX_TYPES = ["withdrawal","send","paybill","buygoods"];

export default function Admin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const loadAll = async () => {
    const [u, p, t] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("cost_providers").select("*").eq("is_global", true).order("name"),
      supabase.from("cost_tiers").select("*").eq("is_global", true).order("min_amount"),
    ]);
    setUsers(u.data || []);
    setProviders(p.data || []);
    setTiers(t.data || []);
  };
  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  if (isAdmin === null) return <div className="p-8 text-muted-foreground">Checking access…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const setUserField = async (target: string, patch: { is_active?: boolean; premium?: boolean; modules?: string[]; is_admin?: boolean }) => {
    const { error } = await supabase.rpc("admin_set_user", {
      _target: target,
      _is_active: patch.is_active ?? null,
      _premium: patch.premium ?? null,
      _modules: patch.modules ?? null,
      _is_admin: patch.is_admin ?? null,
    });
    if (error) toast.error(error.message); else { toast.success("Updated"); loadAll(); }
  };

  const downloadBackup = async () => {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://yhwmbyjwtnxjnehsprwq.supabase.co/functions/v1/admin-backup`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fintask-backup-${new Date().toISOString().slice(0,10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary"/> Admin Console</h1>
          <p className="text-sm text-muted-foreground">Manage users, costs, features, and backups</p>
        </div>
        <Button onClick={downloadBackup} disabled={downloading}>
          <Download className="h-4 w-4 mr-2"/> {downloading ? "Preparing…" : "Download SQL backup"}
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="costs">Transaction Costs</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          {users.map(u => <UserRow key={u.id} u={u} onChange={setUserField} self={u.id === user!.id} />)}
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <GlobalCostManager providers={providers} tiers={tiers} onChange={loadAll} />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Database backup</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Downloads a complete <code>.sql</code> dump of every table (users, transactions, tasks, groups, etc.) wrapped in a transaction.
                Restore by running the file against any Postgres database.
              </p>
              <Button onClick={downloadBackup} disabled={downloading}>
                <Download className="h-4 w-4 mr-2"/> {downloading ? "Preparing…" : "Download SQL backup"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserRow({ u, onChange, self }: any) {
  const [mods, setMods] = useState<string[]>(u.modules || []);
  useEffect(() => setMods(u.modules || []), [u.modules]);
  const toggleMod = (m: string) => {
    const next = mods.includes(m) ? mods.filter(x => x !== m) : [...mods, m];
    setMods(next);
    onChange(u.id, { modules: next });
  };
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="font-medium flex items-center gap-2">
              {u.display_name || u.email}
              {u.is_admin && <Badge className="bg-primary"><Shield className="h-3 w-3 mr-1"/>Admin</Badge>}
              {u.premium && <Badge variant="secondary"><Crown className="h-3 w-3 mr-1"/>Premium</Badge>}
              {!u.is_active && <Badge variant="destructive">Deactivated</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{u.email} · joined {new Date(u.created_at).toLocaleDateString()}</div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={u.is_active} disabled={self} onCheckedChange={(v) => onChange(u.id, { is_active: v })} /> Active
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={u.premium} onCheckedChange={(v) => onChange(u.id, { premium: v })} /> Premium
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={u.is_admin} disabled={self} onCheckedChange={(v) => onChange(u.id, { is_admin: v })} /> Admin
            </label>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap pt-2 border-t">
          <span className="text-xs text-muted-foreground self-center mr-2">Modules:</span>
          {MODULES.map(m => (
            <Button key={m} size="sm" variant={mods.includes(m) ? "default" : "outline"} onClick={() => toggleMod(m)}>
              {m}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GlobalCostManager({ providers, tiers, onChange }: any) {
  const [providerId, setProviderId] = useState<string | null>(null);
  useEffect(() => { if (providers.length && !providerId) setProviderId(providers[0].id); }, [providers]);
  const [newProv, setNewProv] = useState("");
  const [activeType, setActiveType] = useState("withdrawal");
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [fee, setFee] = useState("");

  const provTiers = tiers.filter((t: any) => t.provider_id === providerId && t.tx_type === activeType);

  const addProv = async () => {
    if (!newProv.trim()) return;
    const { error } = await supabase.from("cost_providers").insert({ name: newProv.trim(), is_global: true, user_id: null, icon: "📱" });
    if (error) toast.error(error.message); else { setNewProv(""); onChange(); }
  };
  const delProv = async (id: string) => {
    await supabase.from("cost_tiers").delete().eq("provider_id", id);
    await supabase.from("cost_providers").delete().eq("id", id);
    onChange();
  };
  const addTier = async () => {
    if (!providerId) return;
    const { error } = await supabase.from("cost_tiers").insert({
      provider_id: providerId, tx_type: activeType, is_global: true, user_id: null,
      min_amount: Number(min), max_amount: Number(max), fee: Number(fee),
    });
    if (error) toast.error(error.message); else { setMin(""); setMax(""); setFee(""); onChange(); }
  };
  const delTier = async (id: string) => { await supabase.from("cost_tiers").delete().eq("id", id); onChange(); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Global cost providers</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {providers.map((p: any) => (
              <div key={p.id} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 ${providerId === p.id ? "bg-primary-soft border-primary" : ""}`}>
                <button onClick={() => setProviderId(p.id)} className="text-sm">{p.icon} {p.name}</button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delProv(p.id)}><Trash2 className="h-3 w-3"/></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New provider (e.g. M-Pesa)" value={newProv} onChange={(e) => setNewProv(e.target.value)} />
            <Button onClick={addProv}><Plus className="h-4 w-4"/></Button>
          </div>
        </CardContent>
      </Card>

      {providerId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tiers (applies to all users)</CardTitle></CardHeader>
          <CardContent>
            <Tabs value={activeType} onValueChange={setActiveType}>
              <TabsList>{TX_TYPES.map(t => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}</TabsList>
              <TabsContent value={activeType} className="mt-3 space-y-3">
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-2">Min</th><th className="px-4 py-2">Max</th><th className="px-4 py-2">Fee</th><th></th></tr></thead>
                    <tbody>
                      {provTiers.map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-4 py-2">{fmtKES(r.min_amount)}</td>
                          <td className="px-4 py-2">{fmtKES(r.max_amount)}</td>
                          <td className="px-4 py-2">{fmtKES(r.fee)}</td>
                          <td className="px-4 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => delTier(r.id)}><Trash2 className="h-4 w-4"/></Button></td>
                        </tr>
                      ))}
                      {provTiers.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">No tiers yet</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input className="w-28" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} />
                  <Input className="w-28" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} />
                  <Input className="w-28" placeholder="Fee" value={fee} onChange={(e) => setFee(e.target.value)} />
                  <Button onClick={addTier}><Plus className="h-4 w-4 mr-1"/>Add tier</Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
