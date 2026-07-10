import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, ArrowLeft, ChevronDown, Sparkles, Filter, BarChart3, Eye } from "lucide-react";
import ReportRenderer from "@/components/reports/ReportRenderer";
import {
  ReportConfig, ReportSource, ReportMetric, ReportGroupBy, ReportChart,
} from "@/lib/reportEngine";

const emptyConfig: ReportConfig = {
  source: "transactions",
  metric: "sum_amount",
  groupBy: "category",
  chart: "bar",
  sort: "value_desc",
  limit: 10,
  filters: { dateShortcut: "month", txType: "expense" },
};

const CHART_OPTIONS: { value: ReportChart; label: string; icon: string }[] = [
  { value: "bar", label: "Bar", icon: "📊" },
  { value: "line", label: "Line", icon: "📈" },
  { value: "area", label: "Area", icon: "🌄" },
  { value: "pie", label: "Pie", icon: "🥧" },
  { value: "stat", label: "Cards", icon: "🔢" },
  { value: "table", label: "Table", icon: "📋" },
];

const METRIC_OPTIONS: { value: ReportMetric; label: string; hint: string }[] = [
  { value: "sum_amount", label: "Total amount", hint: "Add up amounts" },
  { value: "count", label: "How many", hint: "Count the records" },
  { value: "avg_amount", label: "Average amount", hint: "Mean per record" },
  { value: "net", label: "Net (income − expense)", hint: "Money left over" },
];

const GROUP_OPTIONS: { value: ReportGroupBy; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "wallet", label: "Wallet" },
  { value: "type", label: "Type (income/expense)" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "none", label: "Don't group (one total)" },
];

const DATE_CHIPS: { value: any; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

const TYPE_CHIPS: { value: any; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
];

export default function CustomReportBuilder() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📊");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<ReportConfig>(emptyConfig);
  const [saving, setSaving] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [w, c] = await Promise.all([
        supabase.from("wallets").select("id,name").eq("user_id", user.id),
        supabase.from("categories").select("id,name,icon,type").eq("user_id", user.id),
      ]);
      setWallets(w.data || []);
      setCategories(c.data || []);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (isNew || !user) return;
    (async () => {
      const { data } = await (supabase as any).from("custom_reports").select("*").eq("id", id).maybeSingle();
      if (data) {
        setName(data.name); setEmoji(data.emoji); setDescription(data.description || "");
        setConfig({ ...emptyConfig, ...data.config });
      }
    })();
  }, [id, user?.id]);

  const save = async () => {
    if (!name.trim()) { toast.error("Give your report a name first"); return; }
    setSaving(true);
    const payload = { user_id: user!.id, name, emoji, description, config };
    const q = isNew
      ? (supabase as any).from("custom_reports").insert(payload).select().single()
      : (supabase as any).from("custom_reports").update(payload).eq("id", id).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Report saved");
    navigate(`/finance/reports/custom/${data.id}`);
  };

  const updateFilters = (patch: Partial<NonNullable<ReportConfig["filters"]>>) =>
    setConfig(c => ({ ...c, filters: { ...c.filters, ...patch } }));
  const f = config.filters || {};

  const toggleId = (list: string[] | undefined, id: string): string[] => {
    const s = new Set(list || []);
    s.has(id) ? s.delete(id) : s.add(id);
    return Array.from(s);
  };

  const filteredCategories = useMemo(() => {
    if (f.txType && f.txType !== "all") return categories.filter(c => c.type === f.txType);
    return categories;
  }, [categories, f.txType]);

  const activeFilterCount =
    (f.dateShortcut && f.dateShortcut !== "all" ? 1 : 0) +
    (f.txType && f.txType !== "all" ? 1 : 0) +
    (f.walletIds?.length ? 1 : 0) +
    (f.categoryIds?.length ? 1 : 0) +
    (f.minAmount != null || f.maxAmount != null ? 1 : 0) +
    (f.search ? 1 : 0);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/finance/reports/custom")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to reports
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/finance/reports/custom")}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {isNew ? "Save report" : "Update"}
          </Button>
        </div>
      </div>

      {/* Name + description card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <div>
              <Label className="text-xs">Icon</Label>
              <Input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
                className="w-16 text-center text-2xl h-12" />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Report name</Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. My grocery spending this year"
                className="h-12 text-lg font-medium" autoFocus />
            </div>
          </div>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Optional — a short note about what this shows" className="resize-none" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Build panel */}
        <div className="space-y-4">
          {/* What to show */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> What do you want to see?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Select value={config.source} onValueChange={(v: ReportSource) => setConfig(c => ({ ...c, source: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactions">💳 My transactions</SelectItem>
                      <SelectItem value="budgets">🎯 My budgets</SelectItem>
                      <SelectItem value="savings">🐷 Savings contributions</SelectItem>
                      <SelectItem value="recurring">🔁 Recurring rules</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Measure</Label>
                  <Select value={config.metric} onValueChange={(v: ReportMetric) => setConfig(c => ({ ...c, metric: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METRIC_OPTIONS.map(o =>
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex flex-col">
                            <span>{o.label}</span>
                            <span className="text-[10px] text-muted-foreground">{o.hint}</span>
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Break down by</Label>
                <Select value={config.groupBy} onValueChange={(v: ReportGroupBy) => setConfig(c => ({ ...c, groupBy: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          {config.source === "transactions" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" /> Narrow it down
                  {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount} active</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs mb-2 block">Time period</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DATE_CHIPS.map(c => (
                      <button key={c.value} type="button"
                        onClick={() => updateFilters({ dateShortcut: c.value })}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          f.dateShortcut === c.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-muted"
                        }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-2 block">Transaction type</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {TYPE_CHIPS.map(c => (
                      <button key={c.value} type="button"
                        onClick={() => updateFilters({ txType: c.value })}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          (f.txType || "all") === c.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-muted"
                        }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MultiPicker label="Wallets" placeholder="All wallets"
                    options={wallets.map(w => ({ id: w.id, label: w.name }))}
                    selected={f.walletIds || []}
                    onToggle={(id) => updateFilters({ walletIds: toggleId(f.walletIds, id) })}
                    onClear={() => updateFilters({ walletIds: [] })} />
                  <MultiPicker label="Categories" placeholder="All categories"
                    options={filteredCategories.map(c => ({ id: c.id, label: `${c.icon || ""} ${c.name}`.trim() }))}
                    selected={f.categoryIds || []}
                    onToggle={(id) => updateFilters({ categoryIds: toggleId(f.categoryIds, id) })}
                    onClear={() => updateFilters({ categoryIds: [] })} />
                </div>

                <div>
                  <Label className="text-xs mb-2 block">Amount range (KES)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Min" value={f.minAmount ?? ""}
                      onChange={e => updateFilters({ minAmount: e.target.value ? Number(e.target.value) : undefined })} />
                    <Input type="number" placeholder="Max" value={f.maxAmount ?? ""}
                      onChange={e => updateFilters({ maxAmount: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Search in description</Label>
                  <Input value={f.search || ""} onChange={e => updateFilters({ search: e.target.value })}
                    placeholder="Optional keyword (e.g. Uber, Naivas)" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visualize */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> How should it look?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs mb-2 block">Chart style</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CHART_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => setConfig(c => ({ ...c, chart: o.value }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition ${
                        config.chart === o.value
                          ? "bg-primary-soft border-primary text-primary"
                          : "hover:bg-muted"
                      }`}>
                      <span className="text-xl">{o.icon}</span>
                      <span className="text-[11px] font-medium">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Sort</Label>
                  <Select value={config.sort || "value_desc"} onValueChange={(v: any) => setConfig(c => ({ ...c, sort: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value_desc">Highest first</SelectItem>
                      <SelectItem value="value_asc">Lowest first</SelectItem>
                      <SelectItem value="label_asc">A → Z</SelectItem>
                      <SelectItem value="label_desc">Z → A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Show top</Label>
                  <Input type="number" min={1} max={50} value={config.limit ?? 10}
                    onChange={e => setConfig(c => ({ ...c, limit: Math.max(1, Number(e.target.value) || 10) }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Live preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-2xl">{emoji}</span>{name || "Untitled report"}
                </div>
                {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
              </div>
              <ReportRenderer config={config} height={380} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky mobile save bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-3 flex gap-2 lg:hidden z-40">
        <Button variant="outline" className="flex-1" onClick={() => navigate("/finance/reports/custom")}>Cancel</Button>
        <Button className="flex-1" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

function MultiPicker({
  label, placeholder, options, selected, onToggle, onClear,
}: {
  label: string; placeholder: string;
  options: { id: string; label: string }[];
  selected: string[]; onToggle: (id: string) => void; onClear: () => void;
}) {
  const summary = selected.length === 0 ? placeholder :
    selected.length === 1 ? options.find(o => o.id === selected[0])?.label || "1 selected" :
    `${selected.length} selected`;
  return (
    <div>
      <Label className="text-xs mb-1 block">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 max-h-72 overflow-auto">
          {options.length === 0 && <div className="text-xs text-muted-foreground p-2">No options</div>}
          {options.map(o => (
            <label key={o.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
              <Checkbox checked={selected.includes(o.id)} onCheckedChange={() => onToggle(o.id)} />
              <span className="text-sm truncate">{o.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full mt-1" onClick={onClear}>Clear</Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
