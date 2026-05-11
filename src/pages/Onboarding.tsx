import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Trash2, Plus, Check } from "lucide-react";

const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "🍔", type: "expense" },
  { name: "Transport", icon: "🚗", type: "expense" },
  { name: "Bills", icon: "💡", type: "expense" },
  { name: "Shopping", icon: "🛍️", type: "expense" },
  { name: "Entertainment", icon: "🎬", type: "expense" },
  { name: "Health", icon: "💊", type: "expense" },
  { name: "Savings", icon: "🐷", type: "expense" },
  { name: "Salary", icon: "💼", type: "income" },
  { name: "Freelance", icon: "💻", type: "income" },
  { name: "Other", icon: "💰", type: "income" },
];

const MPESA_TIERS = {
  withdrawal: [[1,49,0],[50,100,11],[101,2500,29],[2501,3500,52],[3501,5000,65],[5001,35000,0]],
  send: [[1,49,0],[50,100,11],[101,2500,29],[2501,3500,52],[3501,5000,65],[5001,35000,0]],
  paybill: [[1,100,11],[101,2500,25],[2501,5000,25],[5001,10000,40],[10001,35000,60]],
  buygoods: [[1,35000,0]],
};

const MODULE_OPTIONS = [
  { key: "finance", icon: "💰", title: "Finance Tracking", desc: "Transactions, budgets, savings, recurring rules" },
  { key: "tasks", icon: "✅", title: "Task Management", desc: "To-do list, Kanban board, planned costs" },
  { key: "applications", icon: "🎓", title: "Application Tracking", desc: "Scholarships and job applications with deadlines" },
] as const;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { user, refreshFocus } = useAuth();
  const [step, setStep] = useState(1);
  const [modules, setModules] = useState<string[]>(["finance", "tasks", "applications"]);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [wallets, setWallets] = useState<{ name: string; type: string; opening_balance: number }[]>([
    { name: "M-Pesa", type: "mpesa", opening_balance: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const needsFinance = modules.includes("finance");
  const focus = needsFinance && modules.includes("tasks") ? "both" : needsFinance ? "finance" : modules.includes("tasks") ? "tasks" : "both";

  useEffect(() => {
    supabase.from("profiles").select("display_name,currency").eq("id", user!.id).maybeSingle()
      .then(({ data }) => { if (data) { setName(data.display_name || ""); setCurrency(data.currency || "KES"); } });
  }, [user]);

  const toggle = (k: string) => setModules(m => m.includes(k) ? m.filter(x => x !== k) : [...m, k]);

  const finish = async () => {
    setSaving(true);
    try {
      await supabase.from("profiles").upsert({
        id: user!.id, display_name: name, currency, onboarded: true,
        feature_focus: focus, modules,
      });
      if (needsFinance) {
        const validWallets = wallets.filter(w => w.name.trim());
        if (validWallets.length) {
          await supabase.from("wallets").insert(validWallets.map(w => ({ ...w, user_id: user!.id })));
        }
        await supabase.from("categories").insert(DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user!.id })));
        const { data: prov } = await supabase.from("cost_providers").insert({ user_id: user!.id, name: "M-Pesa", icon: "📱" }).select().single();
        if (prov) {
          const tiers = Object.entries(MPESA_TIERS).flatMap(([tx_type, rows]) =>
            rows.map(([min_amount, max_amount, fee]) => ({
              user_id: user!.id, provider_id: prov.id, tx_type, min_amount, max_amount, fee,
            }))
          );
          await supabase.from("cost_tiers").insert(tiers);
        }
      }
      await refreshFocus();
      toast.success("Welcome to FinTask! 🎉");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const totalSteps = needsFinance ? 4 : 3;
  const next = () => {
    if (step === 2 && !needsFinance) setStep(4);
    else setStep(step + 1);
  };
  const back = () => {
    if (step === 4 && !needsFinance) setStep(2);
    else setStep(step - 1);
  };
  const stepDisplay = !needsFinance && step === 4 ? 3 : step;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary-soft to-background">
      <div className="w-full max-w-lg ft-card p-8 space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i + 1 <= stepDisplay ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <div className="text-xs text-muted-foreground">Step {stepDisplay} of {totalSteps}</div>

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Pick your modules</h1>
            <p className="text-sm text-muted-foreground">Tick everything you'd like to use. You can add or remove modules later in <span className="font-medium">Settings → Modules</span>.</p>
            <div className="grid gap-3">
              {MODULE_OPTIONS.map(o => {
                const active = modules.includes(o.key);
                return (
                  <button key={o.key} type="button" onClick={() => toggle(o.key)}
                    className={`text-left rounded-xl border-2 p-4 transition-colors flex items-center gap-3 ${active ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"}`}>
                    <span className="text-2xl">{o.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{o.title}</div>
                      <div className="text-xs text-muted-foreground">{o.desc}</div>
                    </div>
                    <div className={`h-5 w-5 rounded border-2 grid place-items-center ${active ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                      {active && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <Button onClick={() => setStep(2)} className="w-full" disabled={modules.length === 0}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Tell us about yourself</h1>
            <div>
              <Label>Your name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            {needsFinance && (
              <div>
                <Label>Default currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button onClick={next} disabled={!name} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && needsFinance && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Set up your wallets</h1>
            <p className="text-sm text-muted-foreground">Add at least one place where you keep your money.</p>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {wallets.map((w, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Wallet name" value={w.name} onChange={(e) => {
                    const c = [...wallets]; c[i].name = e.target.value; setWallets(c);
                  }} />
                  <Select value={w.type} onValueChange={(v) => { const c = [...wallets]; c[i].type = v; setWallets(c); }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" className="w-28" placeholder="0" value={w.opening_balance} onChange={(e) => {
                    const c = [...wallets]; c[i].opening_balance = Number(e.target.value); setWallets(c);
                  }} />
                  {wallets.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setWallets(wallets.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWallets([...wallets, { name: "", type: "other", opening_balance: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Add wallet
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button onClick={next} disabled={!wallets.some(w => w.name)} className="flex-1">Continue</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">You're all set! 🎉</h1>
            <p className="text-sm text-muted-foreground">
              Modules enabled: <span className="font-medium">{modules.map(m => MODULE_OPTIONS.find(o => o.key === m)?.title).join(", ") || "none"}</span>.
              Manage them anytime from Settings → Modules.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Profile created</li>
              {needsFinance && <>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {wallets.filter(w => w.name).length} wallet(s) ready</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> M-Pesa fee schedule loaded</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> 10 default categories</li>
              </>}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="flex-1">Back</Button>
              <Button onClick={finish} disabled={saving} className="flex-1">{saving ? "Setting up…" : "Enter FinTask"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
