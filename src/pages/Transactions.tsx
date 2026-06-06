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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Download, Repeat, Pencil } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { DateFilter } from "@/components/DateFilter";
import { DateShortcut, DateRange, inRange } from "@/lib/dateFilters";

export default function Transactions() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<{ shortcut: DateShortcut; range: DateRange; custom?: any }>({ shortcut: "all", range: null });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [tx, w, c, t, tk] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase.from("categories").select("*").eq("user_id", user.id),
      supabase.from("cost_tiers").select("*").eq("is_global", true),
      supabase.from("tasks").select("id, title").eq("user_id", user.id),
    ]);
    setTxs(tx.data || []); setWallets(w.data || []); setCategories(c.data || []);
    setTiers((t.data || []) as Tier[]); setTasks(tk.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = txs.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (walletFilter !== "all" && t.wallet_id !== walletFilter) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (!inRange(t.date, dateFilter.range)) return false;
    return true;
  });

  const catName = (id: string) => categories.find(c => c.id === id)?.name || "—";
  const catIcon = (id: string) => categories.find(c => c.id === id)?.icon || "💰";
  const walletName = (id: string) => wallets.find(w => w.id === id)?.name || "—";
  const taskTitle = (id: string) => tasks.find(t => t.id === id)?.title;

  const exportExcel = () => {
    const rows = filtered.map(t => ({
      Date: fmtDate(t.date), Description: t.description, Category: catName(t.category_id),
      Wallet: walletName(t.wallet_id), Type: t.type, Amount: Number(t.amount),
      Method: METHOD_LABELS[t.method] || t.method, Fee: Number(t.fee || 0),
      "True Cost": t.type === "expense" ? Number(t.amount) + Number(t.fee || 0) : Number(t.amount),
      Task: taskTitle(t.task_id) || "", Note: t.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `fintask-transactions-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} of {txs.length}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <TxSheet wallets={wallets} categories={categories} tiers={tiers} tasks={tasks} onSaved={load} />
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <DateFilter value={dateFilter} onChange={setDateFilter} />
          <div className="flex flex-wrap gap-3">
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
            <Select value={walletFilter} onValueChange={setWalletFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All wallets" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wallets</SelectItem>
                {wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-6 space-y-2">{[0,1,2,3].map(i => <div key={i} className="skeleton h-12" />)}</div>
          : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-muted-foreground mb-4">No transactions match these filters</p>
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
                          {t.task_id && <Badge variant="outline" className="text-[10px]">📋 {taskTitle(t.task_id)?.slice(0,20)}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{catIcon(t.category_id)} {catName(t.category_id)}</td>
                      <td className="px-4 py-2.5">{walletName(t.wallet_id)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : ""}`}>
                        {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{fmtKES(t.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{Number(t.fee) > 0 ? fmtKES(t.fee) : "—"}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="capitalize">{t.type}</Badge></td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <TxSheet wallets={wallets} categories={categories} tiers={tiers} tasks={tasks} tx={t} onSaved={load}
                          trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>} />
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

function TxSheet({ wallets, categories, tiers, tasks, tx, onSaved, trigger }: any) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense" | "transfer">(tx?.type || "expense");
  const [description, setDescription] = useState(tx?.description || "");
  const [amount, setAmount] = useState(tx?.amount?.toString() || "");
  const [categoryId, setCategoryId] = useState(tx?.category_id || "");
  const [walletId, setWalletId] = useState(tx?.wallet_id || "");
  const [toWalletId, setToWalletId] = useState(tx?.to_wallet_id || "");
  const [date, setDate] = useState(tx?.date || new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(tx?.method || "direct");
  const [note, setNote] = useState(tx?.note || "");
  const [taskId, setTaskId] = useState(tx?.task_id || "");
  const [customFee, setCustomFee] = useState(tx?.method === "custom" || tx?.method === "bank_transfer" || tx?.method === "bank_to_mpesa" ? tx?.fee?.toString() : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && tx) {
      setType(tx.type); setDescription(tx.description); setAmount(tx.amount?.toString());
      setCategoryId(tx.category_id || ""); setWalletId(tx.wallet_id); setToWalletId(tx.to_wallet_id || "");
      setDate(tx.date); setMethod(tx.method || "direct"); setNote(tx.note || ""); setTaskId(tx.task_id || "");
      setCustomFee(tx.fee?.toString() || "");
    }
  }, [open, tx]);

  const isCustomFeeMethod = method === "custom" || method === "bank_transfer" || method === "bank_to_mpesa";
  const autoFee = type !== "income" && !isCustomFeeMethod ? lookupFee(Number(amount), method, tiers) : 0;
  const fee = isCustomFeeMethod ? Number(customFee || 0) : autoFee;
  const filteredCats = categories.filter((c: any) => c.type === type || type === "transfer");

  const submit = async () => {
    if (!description || !amount || !walletId) { toast.error("Fill required fields"); return; }
    if (type === "transfer" && !toWalletId) { toast.error("Pick destination wallet"); return; }
    setSaving(true);
    const payload: any = {
      description, amount: Number(amount), type,
      category_id: categoryId || null, wallet_id: walletId,
      to_wallet_id: type === "transfer" ? toWalletId : null,
      date, method, fee, note: note || null,
      task_id: taskId || null,
    };
    const res = tx
      ? await supabase.from("transactions").update(payload).eq("id", tx.id)
      : await supabase.from("transactions").insert({ ...payload, user_id: user!.id });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(tx ? "Transaction updated" : "Transaction added");
    setOpen(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger || <Button><Plus className="h-4 w-4 mr-1" /> Add transaction</Button>}</SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>{tx ? "Edit transaction" : "New transaction"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-3 gap-2">
            {(["income","expense","transfer"] as const).map(t => (
              <Button key={t} type="button" variant={type === t ? "default" : "outline"} onClick={() => setType(t)} className="capitalize">{t}</Button>
            ))}
          </div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lunch at cafe" /></div>
          <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          {type !== "transfer" && (
            <div><Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{filteredCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>{type === "transfer" ? "From wallet" : "Wallet"}</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {type === "transfer" && (
            <div><Label>To wallet</Label>
              <Select value={toWalletId} onValueChange={setToWalletId}>
                <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>{wallets.filter((w:any) => w.id !== walletId).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {type !== "income" && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <Label>Transaction method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              {isCustomFeeMethod ? (
                <div><Label className="text-xs">Custom fee (KES)</Label><Input type="number" value={customFee} onChange={(e) => setCustomFee(e.target.value)} placeholder="0" /></div>
              ) : autoFee > 0 ? <div className="text-sm text-warning">Auto fee: {fmtKES(autoFee)}</div> : null}
            </div>
          )}
          {type === "expense" && tasks.length > 0 && (
            <div><Label>Link to task (optional)</Label>
              <Select value={taskId || "none"} onValueChange={(v) => setTaskId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No task" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tasks.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Note (optional)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
          <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Saving…" : tx ? "Save changes" : "Save transaction"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
