import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, LogOut, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import HelpTour from "@/components/HelpTour";

export default function Settings() {
  const { user, signOut, refreshFocus } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [tour, setTour] = useState(false);

  const load = async () => {
    if (!user) return;
    const [p, w, c, t, pr] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("cost_tiers").select("*").eq("user_id", user.id).order("min_amount"),
      supabase.from("cost_providers").select("*").eq("user_id", user.id),
    ]);
    setProfile(p.data); setWallets(w.data || []); setCategories(c.data || []);
    setTiers(t.data || []); setProviders(pr.data || []);
  };
  useEffect(() => { load(); }, [user]);

  const saveProfile = async () => {
    await supabase.from("profiles").update({
      display_name: profile.display_name, currency: profile.currency, feature_focus: profile.feature_focus,
    }).eq("id", user!.id);
    await refreshFocus();
    toast.success("Profile updated");
  };

  const saveNotifications = async () => {
    await supabase.from("profiles").update({
      notify_email: profile.notify_email,
      notify_tasks: profile.notify_tasks,
      notify_applications: profile.notify_applications,
      notify_recurring: profile.notify_recurring,
      notify_budgets: profile.notify_budgets,
      reminder_lead_minutes: Number(profile.reminder_lead_minutes) || 30,
    }).eq("id", user!.id);
    toast.success("Notification preferences saved");
  };

  const replayTour = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ tour_completed: false }).eq("id", user.id);
    setTour(true);
  };

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  return (
    <div className="space-y-6">
      {tour && <HelpTour force onClose={() => setTour(false)} />}
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="costs">Transaction Costs</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              {profile && <>
                <div><Label>Display name</Label><Input value={profile.display_name || ""} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
                <div><Label>Currency</Label>
                  <Select value={profile.currency} onValueChange={(v) => setProfile({ ...profile, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KES">KES</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Workspace focus</Label>
                  <Select value={profile.feature_focus || "both"} onValueChange={(v) => setProfile({ ...profile, feature_focus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">✨ Both — Finance + Tasks</SelectItem>
                      <SelectItem value="finance">💰 Finance only</SelectItem>
                      <SelectItem value="tasks">✅ Tasks only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={saveProfile}>Save changes</Button>
              </>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              {profile && <>
                <div className="flex items-center justify-between">
                  <div><Label>Email reminders</Label><p className="text-xs text-muted-foreground">Daily digest sent to {user?.email}</p></div>
                  <Switch checked={!!profile.notify_email} onCheckedChange={(v) => setProfile({ ...profile, notify_email: v })} />
                </div>
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground">Include in digest</Label>
                  {[
                    { key: "notify_tasks", label: "Tasks due or overdue" },
                    { key: "notify_applications", label: "Application deadlines approaching" },
                    { key: "notify_recurring", label: "Pending recurring approvals" },
                    { key: "notify_budgets", label: "Budgets near or over limit" },
                  ].map(o => (
                    <div key={o.key} className="flex items-center justify-between">
                      <span className="text-sm">{o.label}</span>
                      <Switch checked={!!profile[o.key]} disabled={!profile.notify_email} onCheckedChange={(v) => setProfile({ ...profile, [o.key]: v })} />
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <Label>Default calendar reminder (minutes before)</Label>
                  <Input type="number" value={profile.reminder_lead_minutes ?? 30} onChange={(e) => setProfile({ ...profile, reminder_lead_minutes: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Used when exporting tasks/applications to calendar.</p>
                </div>
                <Button onClick={saveNotifications}>Save preferences</Button>
              </>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <WalletsManager wallets={wallets} onChange={load} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesManager categories={categories} onChange={load} />
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <CostManager providers={providers} tiers={tiers} onChange={load} />
        </TabsContent>

        <TabsContent value="account" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={replayTour}><PlayCircle className="h-4 w-4 mr-1" /> Replay onboarding tour</Button>
              <Button variant="outline" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WalletsManager({ wallets, onChange }: any) {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [name, setName] = useState(""); const [type, setType] = useState("other"); const [opening, setOpening] = useState("0");

  const add = async () => {
    if (!name) return;
    await supabase.from("wallets").insert({ user_id: user!.id, name, type, opening_balance: Number(opening) });
    setName(""); setOpening("0"); onChange();
  };
  const save = async (w: any) => {
    const e = editing[w.id]; if (!e) return;
    await supabase.from("wallets").update({ name: e.name, type: e.type, opening_balance: Number(e.opening_balance) }).eq("id", w.id);
    const ne = { ...editing }; delete ne[w.id]; setEditing(ne);
    toast.success("Wallet updated"); onChange();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this wallet? Transactions linked to it remain.")) return;
    await supabase.from("wallets").delete().eq("id", id); onChange();
  };
  return (
    <Card><CardHeader><CardTitle className="text-base">Wallets</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {wallets.map((w: any) => {
            const e = editing[w.id];
            return (
              <div key={w.id} className="border rounded-lg p-3">
                {e ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input value={e.name} onChange={(ev) => setEditing({ ...editing, [w.id]: { ...e, name: ev.target.value } })} className="flex-1 min-w-32" />
                    <Select value={e.type} onValueChange={(v) => setEditing({ ...editing, [w.id]: { ...e, type: v } })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem><SelectItem value="mmf">MMF</SelectItem>
                        <SelectItem value="chama">Chama</SelectItem><SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" className="w-28" value={e.opening_balance} onChange={(ev) => setEditing({ ...editing, [w.id]: { ...e, opening_balance: ev.target.value } })} />
                    <Button size="sm" onClick={() => save(w)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { const ne = { ...editing }; delete ne[w.id]; setEditing(ne); }}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div><div className="font-medium text-sm">{w.name}</div><div className="text-xs text-muted-foreground capitalize">{w.type} · opening {fmtKES(w.opening_balance)}</div></div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, [w.id]: { ...w } })}>Edit</Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 pt-3 border-t">
          <Input placeholder="Wallet name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-32" />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem><SelectItem value="mmf">MMF</SelectItem>
              <SelectItem value="chama">Chama</SelectItem><SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder="0" className="w-28" value={opening} onChange={(e) => setOpening(e.target.value)} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoriesManager({ categories, onChange }: any) {
  const { user } = useAuth();
  const [name, setName] = useState(""); const [icon, setIcon] = useState("💰"); const [type, setType] = useState("expense");
  const add = async () => {
    if (!name) return;
    await supabase.from("categories").insert({ user_id: user!.id, name, icon, type });
    setName(""); onChange();
  };
  const remove = async (id: string) => { await supabase.from("categories").delete().eq("id", id); onChange(); };
  return (
    <Card><CardHeader><CardTitle className="text-base">Categories</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          {categories.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-2"><span className="text-xl">{c.icon}</span><div><div className="text-sm font-medium">{c.name}</div><div className="text-xs text-muted-foreground capitalize">{c.type}</div></div></div>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-3 border-t">
          <Input className="w-16" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🏷️" />
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem></SelectContent>
          </Select>
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CostManager({ providers, tiers, onChange }: any) {
  const { user } = useAuth();
  const [providerId, setProviderId] = useState<string | null>(null);
  useEffect(() => { if (providers.length && !providerId) setProviderId(providers[0].id); }, [providers]);
  const provTiers = tiers.filter((t: any) => t.provider_id === providerId);
  const types = ["withdrawal", "send", "paybill", "buygoods"];
  const [activeType, setActiveType] = useState("withdrawal");
  const rows = provTiers.filter((t: any) => t.tx_type === activeType);
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [fee, setFee] = useState("");

  const add = async () => {
    if (!providerId) return;
    await supabase.from("cost_tiers").insert({
      user_id: user!.id, provider_id: providerId, tx_type: activeType,
      min_amount: Number(min), max_amount: Number(max), fee: Number(fee),
    });
    setMin(""); setMax(""); setFee(""); onChange();
  };
  const remove = async (id: string) => { await supabase.from("cost_tiers").delete().eq("id", id); onChange(); };

  return (
    <Card><CardHeader><CardTitle className="text-base">Transaction Cost Manager</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {providers.length > 0 && (
          <Select value={providerId || ""} onValueChange={setProviderId}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList>{types.map(t => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}</TabsList>
          <TabsContent value={activeType} className="mt-3 space-y-2">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-2">Min</th><th className="px-4 py-2">Max</th><th className="px-4 py-2">Fee</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{fmtKES(r.min_amount)}</td>
                      <td className="px-4 py-2">{fmtKES(r.max_amount)}</td>
                      <td className="px-4 py-2">{fmtKES(r.fee)}</td>
                      <td className="px-4 py-2 text-right"><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} />
              <Input type="number" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} />
              <Input type="number" placeholder="Fee" value={fee} onChange={(e) => setFee(e.target.value)} />
              <Button onClick={add}><Plus className="h-4 w-4" /></Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
