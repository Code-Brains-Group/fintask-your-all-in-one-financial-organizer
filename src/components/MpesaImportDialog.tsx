import { useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, FileUp, Loader2, LockKeyhole, Pencil, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, METHOD_LABELS } from "@/lib/finance";
import { MpesaStatementRow, mpesaMethod, parseMpesaStatement } from "@/lib/mpesa";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TxType = "income" | "expense" | "transfer";
type Draft = MpesaStatementRow & {
  type: TxType;
  categoryId: string;
  walletId: string;
  toWalletId: string;
  method: string;
  includeCharge?: boolean;
};

export function MpesaImportDialog({ wallets, categories, existingTransactions, onSaved }: any) {
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [statementTotal, setStatementTotal] = useState(0);

  const selected = drafts.find((draft) => draft.id === selectedId) || drafts[0];
  const selectedPosition = selected ? drafts.findIndex((draft) => draft.id === selected.id) + 1 : 0;
  const completedCount = Math.max(statementTotal - drafts.length, 0);
  const importedTransactions = useMemo(() => existingTransactions || [], [existingTransactions]);
  const isPossibleDuplicate = (draft: Draft) => importedTransactions.some((tx: any) =>
    String(tx.note || "").includes(`M-PESA receipt ${draft.receipt} `) &&
    Number(tx.amount) === Math.abs(draft.amount) &&
    String(tx.description).trim() === draft.description.trim(),
  );
  const charges = drafts.filter((draft) => draft.isCharge && draft.includeCharge === undefined).length;
  const paidIn = drafts.filter((draft) => draft.amount > 0).reduce((sum, draft) => sum + draft.amount, 0);
  const paidOut = drafts.filter((draft) => draft.amount < 0).reduce((sum, draft) => sum + Math.abs(draft.amount), 0);

  const parse = async () => {
    if (!file) { toast.error("Choose an M-PESA statement PDF"); return; }
    setParsing(true);
    try {
      const rows = await parseMpesaStatement(file, password);
      const transactionCosts = categories.find((category: any) =>
        category.type === "expense" && /transaction\s*(cost|fee)|charges?|fees?/i.test(category.name),
      );
      const firstWallet = wallets.find((wallet: any) => /m[\s-]?pesa/i.test(wallet.name))?.id || (wallets.length === 1 ? wallets[0].id : "");
      const next = rows.map((row) => ({
        ...row,
        type: (row.amount > 0 ? "income" : "expense") as TxType,
        categoryId: row.isCharge ? transactionCosts?.id || "" : "",
        walletId: firstWallet,
        toWalletId: "",
        method: mpesaMethod(row.description),
        includeCharge: row.isCharge ? undefined : true,
      }));
      setDrafts(next);
      setStatementTotal(next.length);
      setSelectedId(next[0]?.id || "");
      toast.success(`${next.length} completed transactions found`);
    } catch (error: any) {
      const message = /password/i.test(error?.message || error?.name || "")
        ? "The PDF password is missing or incorrect."
        : error?.message || "The statement could not be read.";
      toast.error(message);
    } finally {
      setParsing(false);
    }
  };

  const updateSelected = (patch: Partial<Draft>) => {
    if (!selected) return;
    setDrafts((current) => current.map((draft) => draft.id === selected.id ? { ...draft, ...patch } : draft));
  };

  const removeDraft = (id: string) => {
    const index = drafts.findIndex((draft) => draft.id === id);
    const next = drafts.filter((draft) => draft.id !== id);
    setDrafts(next);
    if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id || "");
  };

  const saveSelected = async () => {
    if (!selected || !user) return;
    if (selected.isCharge && selected.includeCharge === undefined) {
      toast.error("Choose whether to add or skip this transaction charge"); return;
    }
    if (!selected.walletId) { toast.error("Choose a wallet"); return; }
    if (selected.type !== "transfer" && !selected.categoryId) { toast.error("Choose a category"); return; }
    if (selected.type === "transfer" && !selected.toWalletId) { toast.error("Choose the destination wallet"); return; }
    if (!selected.description.trim() || !Number.isFinite(Math.abs(selected.amount)) || selected.amount === 0) {
      toast.error("Description and amount are required"); return;
    }

    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      description: selected.description.trim(),
      amount: Math.abs(selected.amount),
      type: selected.type,
      category_id: selected.type === "transfer" ? null : selected.categoryId,
      wallet_id: selected.walletId,
      to_wallet_id: selected.type === "transfer" ? selected.toWalletId : null,
      date: selected.date,
      method: selected.method,
      fee: 0,
      note: `Imported from M-PESA receipt ${selected.receipt} at ${selected.time}`,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    removeDraft(selected.id);
    toast.success("Transaction added");
    onSaved();
  };

  const reset = () => {
    setFile(null); setPassword(""); setDrafts([]); setSelectedId(""); setStatementTotal(0);
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = (value: boolean) => {
    setOpen(value);
    if (!value && !saving) reset();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild><Button variant="outline"><FileUp className="h-4 w-4 mr-1" /> Import M-PESA</Button></DialogTrigger>
      <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] sm:w-full h-[95dvh] sm:h-[92vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Import an M-PESA statement</DialogTitle>
          <DialogDescription>The PDF is unlocked and read on this device. Your password and statement are not uploaded or stored.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs" aria-label="Import progress">
          <Step done={statementTotal > 0} active={statementTotal === 0} number="1" label="Upload PDF" />
          <div className="h-px flex-1 bg-border" />
          <Step done={statementTotal > 0 && !drafts.length} active={drafts.length > 0} number="2" label="Review & add" />
          <div className="h-px flex-1 bg-border" />
          <Step done={statementTotal > 0 && !drafts.length} active={false} number="3" label="Done" />
        </div>

        {statementTotal > 0 && !drafts.length ? (
          <div className="flex-1 grid place-items-center py-8">
            <div className="max-w-md text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-8 w-8" /></div>
              <h3 className="text-xl font-semibold mt-4">Statement review complete</h3>
              <p className="text-sm text-muted-foreground mt-2">All {statementTotal} statement rows have been added or skipped. Your transactions are now available in the transaction list.</p>
              <div className="flex justify-center gap-2 mt-6">
                <Button variant="outline" onClick={reset}>Import another statement</Button>
                <Button onClick={() => close(false)}>Done</Button>
              </div>
            </div>
          </div>
        ) : !drafts.length ? (
          <div className="max-w-xl mx-auto w-full space-y-5 py-8">
            <div className="rounded-xl border-2 border-dashed p-8 text-center bg-muted/20">
              <FileUp className="h-10 w-10 mx-auto text-primary mb-3" />
              <Label htmlFor="mpesa-pdf" className="font-semibold cursor-pointer">Choose M-PESA statement</Label>
              <p className="text-xs text-muted-foreground mt-1">Safaricom detailed statement PDF</p>
              <Input ref={fileInput} id="mpesa-pdf" type="file" accept="application/pdf,.pdf" className="mt-4" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
            <div>
              <Label htmlFor="mpesa-password" className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> PDF password (if required)</Label>
              <Input id="mpesa-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter statement password" className="mt-1" />
            </div>
            <Button className="w-full" onClick={parse} disabled={parsing || !file}>
              {parsing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading statement…</> : "Read transactions"}
            </Button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Summary label="Progress" value={`${completedCount} of ${statementTotal}`} />
              <Summary label="Paid in" value={fmtKES(paidIn)} />
              <Summary label="Paid out" value={fmtKES(paidOut)} />
              <Summary label="Charges awaiting choice" value={String(charges)} warning={charges > 0} />
            </div>
            <div className="grid grid-rows-[180px_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)] gap-3 lg:gap-4 h-[calc(95dvh-225px)] sm:h-[calc(92vh-215px)] min-h-0">
              <div className="border rounded-2xl min-h-0 flex flex-col overflow-hidden bg-card shadow-sm">
                <div className="p-3.5 border-b bg-muted/20 flex items-center justify-between">
                  <div><div className="font-semibold text-sm">Statement transactions</div><div className="text-xs text-muted-foreground">Select a row to edit and add it</div></div>
                  <Button variant="ghost" size="sm" onClick={reset}>New PDF</Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {drafts.map((draft) => (
                      <button key={draft.id} onClick={() => setSelectedId(draft.id)} className={`w-full text-left rounded-xl border p-3 transition-all ${selected?.id === draft.id ? "border-primary bg-primary/[0.07] shadow-sm ring-1 ring-primary/10" : "border-transparent bg-muted/20 hover:border-border hover:bg-muted/50"}`}>
                        <div className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{draft.date} · {draft.time}</span>
                          <span className={`text-sm font-semibold ${draft.amount > 0 ? "text-success" : "text-danger"}`}>{fmtKES(Math.abs(draft.amount))}</span>
                        </div>
                        <div className="text-sm line-clamp-2 mt-1">{draft.description}</div>
                        <div className="flex gap-1 mt-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{draft.type}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{METHOD_LABELS[draft.method] || draft.method}</Badge>
                          {draft.isCharge && <Badge className="text-[10px] bg-warning text-warning-foreground">Transaction cost</Badge>}
                          {isPossibleDuplicate(draft) && <Badge variant="destructive" className="text-[10px]">Possible duplicate</Badge>}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {selected && <div className="border rounded-2xl min-h-0 flex flex-col overflow-hidden bg-card shadow-sm">
                <div className="p-3.5 border-b bg-muted/20 flex items-center justify-between">
                  <div><div className="font-semibold">Review transaction</div><div className="text-xs text-muted-foreground">Receipt {selected.receipt}</div></div>
                  <Button variant="ghost" size="icon" onClick={() => removeDraft(selected.id)} title="Delete from import list"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <ScrollArea className="flex-1"><div className="p-4 space-y-4">
                  {selected.isCharge && <Alert className="border-warning/40 bg-warning/5">
                    <AlertCircle className="h-4 w-4" /><AlertTitle>Transaction cost detected</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>This charge is a separate M-PESA row. Do you want to add it under transaction costs?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant={selected.includeCharge === true ? "default" : "outline"} onClick={() => updateSelected({ includeCharge: true })}><Check className="h-3.5 w-3.5 mr-1" /> Add charge</Button>
                        <Button size="sm" variant="outline" onClick={() => removeDraft(selected.id)}>Skip charge</Button>
                      </div>
                    </AlertDescription>
                  </Alert>}
                  <div className="grid grid-cols-3 gap-2">
                    {(["expense", "transfer", "income"] as TxType[]).map((type) => <Button key={type} type="button" variant={selected.type === type ? "default" : "outline"} className={`capitalize rounded-xl ${selected.type === type ? "shadow-sm" : ""}`} onClick={() => updateSelected({ type, categoryId: "", toWalletId: "" })}>{type}</Button>)}
                  </div>
                  <div><Label>Description</Label><Textarea value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} rows={3} /></div>
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Payment method</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Suggested from the statement details. Change it if the suggestion is not right.</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">Editable</Badge>
                    </div>
                    <Select value={selected.method} onValueChange={(method) => updateSelected({ method })}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                      <SelectContent>{Object.entries(METHOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label>Amount from statement</Label><Input type="number" min="0" step="0.01" value={Math.abs(selected.amount)} onChange={(event) => updateSelected({ amount: (selected.amount < 0 ? -1 : 1) * Number(event.target.value) })} /></div>
                    <div><Label>Date from statement</Label><Input value={selected.date} readOnly className="bg-muted cursor-not-allowed" /><p className="text-[11px] text-muted-foreground mt-1">Statement dates cannot be edited.</p></div>
                  </div>
                  {selected.type !== "transfer" && <div><Label>Category</Label><Select value={selected.categoryId} onValueChange={(categoryId) => updateSelected({ categoryId })}><SelectTrigger><SelectValue placeholder={selected.isCharge ? "Select Transaction Costs" : "Select category"} /></SelectTrigger><SelectContent>{categories.filter((category: any) => category.type === selected.type).map((category: any) => <SelectItem key={category.id} value={category.id}>{category.icon} {category.name}</SelectItem>)}</SelectContent></Select></div>}
                  <div>
                    <div className="flex items-center justify-between gap-2"><Label>{selected.type === "transfer" ? "From wallet" : "Wallet"}</Label>{selected.walletId && <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setDrafts((current) => current.map((draft) => ({ ...draft, walletId: selected.walletId, toWalletId: draft.toWalletId === selected.walletId ? "" : draft.toWalletId })))}>Use for all remaining</Button>}</div>
                    <Select value={selected.walletId} onValueChange={(walletId) => updateSelected({ walletId, toWalletId: walletId === selected.toWalletId ? "" : selected.toWalletId })}><SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger><SelectContent>{wallets.map((wallet: any) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  {selected.type === "transfer" && <div><Label>To wallet</Label><Select value={selected.toWalletId} onValueChange={(toWalletId) => updateSelected({ toWalletId })}><SelectTrigger><SelectValue placeholder="Destination wallet" /></SelectTrigger><SelectContent>{wallets.filter((wallet: any) => wallet.id !== selected.walletId).map((wallet: any) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}</SelectContent></Select></div>}
                </div></ScrollArea>
                <div className="p-3 border-t flex items-center justify-between gap-3">
                  <div><div className="text-xs font-medium">Reviewing {selectedPosition} of {drafts.length} remaining</div><span className="text-[11px] text-muted-foreground"><Pencil className="h-3 w-3 inline mr-1" />Edit anything except the statement date.</span></div>
                  <Button onClick={saveSelected} disabled={saving || (selected.isCharge && selected.includeCharge !== true)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Add transaction</>}</Button>
                </div>
              </div>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`rounded-lg border px-3 py-2 ${warning ? "border-warning/40 bg-warning/5" : "bg-muted/20"}`}><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={`font-semibold mt-0.5 ${warning ? "text-warning" : ""}`}>{value}</div></div>;
}

function Step({ done, active, number, label }: { done: boolean; active: boolean; number: string; label: string }) {
  return <div className={`flex items-center gap-1.5 whitespace-nowrap ${active ? "text-primary font-medium" : done ? "text-success" : "text-muted-foreground"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${active ? "border-primary bg-primary text-primary-foreground" : done ? "border-success bg-success text-success-foreground" : ""}`}>{done ? <Check className="h-3 w-3" /> : number}</span><span className="hidden sm:inline">{label}</span></div>;
}
