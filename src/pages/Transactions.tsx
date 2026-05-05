import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate, METHOD_LABELS, lookupFee, Tier } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Download, Repeat } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Tx = any;

export default function Transactions() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [tx, w, c, t] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("cost_tiers").select("*").eq("user_id", user.id),
    ]);
    setTxs(tx.data || []);
    setWallets(w.data || []);
    setCategories(c.data || []);
    setTiers((t.data || []) as Tier[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = txs.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const catName = (id: string) => categories.find(c => c.id === id)?.name || "—";
  const catIcon = (id: string) => categories.find(c => c.id === id)?.icon || "💰";
  const walletName = (id: string) => wallets.find(w => w.id === id)?.name || "—";

  const exportExcel = () => {
    const rows = filtered.map(t => ({
      Date: fmtDate(t.date),
      Description: t.description,
      Category: catName(t.category_id),
      Wallet: walletName(t.wallet_id),
      Type: t.type,
      Amount: Number(t.amount),
      Method: METHOD_LABELS[t.method] || t.method,
      Fee: Number(t.fee || 0),
      "True Cost": t.type === "expense" ? Number(t.amount) + Number(t.fee || 0) : Number(t.amount),
      Note: t.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `fintask-transactions-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const remove = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} entries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <AddTransactionSheet wallets={wallets} categories={categories} tiers={tiers} onSaved={load} />
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search description…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-6 space-y-2">{[0,1,2,3].map(i => <div key={i} className="skeleton h-12" />)}</div>
          : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-muted-foreground mb-4">No transactions yet — add your first one to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Wallet</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium text-right">Fee</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {t.recurring_rule_id && <Repeat className="h-3 w-3 text-primary" />}
                          {t.description}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{catIcon(t.category_id)} {catName(t.category_id)}</td>
                      <td className="px-4 py-2.5">{walletName(t.wallet_id)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : ""}`}>
                        {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{fmtKES(t.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{Number(t.fee) > 0 ? fmtKES(t.fee) : "—"}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="capitalize">{t.type}</Badge></td>
                      <td className="px-4 py-2.5 text-right">
                        <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddTransactionSheet({ wallets, categories, tiers, onSaved }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("direct");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fee = type === "expense" ? lookupFee(Number(amount), method, tiers) : 0;
  const filteredCats = categories.filter((c: any) => c.type === type || type === "transfer");

  const reset = () => {
    setDescription(""); setAmount(""); setCategoryId(""); setWalletId("");
    setDate(new Date().toISOString().slice(0,10)); setMethod("direct"); setNote("");
  };

  const submit = async () => {
    if (!description || !amount || !walletId) { toast.error("Fill required fields"); return; }
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user!.id, description, amount: Number(amount), type,
      category_id: categoryId || null, wallet_id: walletId, date, method, fee, note: note || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transaction added");
    setOpen(false); reset(); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Add transaction</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>New transaction</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-3 gap-2">
            {(["income","expense","transfer"] as const).map(t => (
              <Button key={t} type="button" variant={type === t ? "default" : "outline"} onClick={() => setType(t)} className="capitalize">{t}</Button>
            ))}
          </div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lunch at cafe" /></div>
          <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div><Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {filteredCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Wallet</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>
                {wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {type === "expense" && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <Label>Transaction method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              {fee > 0 && <div className="text-sm text-warning">Transaction fee: {fmtKES(fee)}</div>}
            </div>
          )}
          <div><Label>Note (optional)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
          <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save transaction"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
