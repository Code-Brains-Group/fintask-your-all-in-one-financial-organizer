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
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import ReportRenderer from "@/components/reports/ReportRenderer";
import {
  ReportConfig, ReportSource, ReportMetric, ReportGroupBy, ReportChart,
  METRIC_LABEL, GROUP_LABEL, CHART_LABEL,
} from "@/lib/reportEngine";

const STEPS = ["Basics", "Data source", "Metric", "Group & filter", "Visualize"] as const;

const emptyConfig: ReportConfig = {
  source: "transactions",
  metric: "sum_amount",
  groupBy: "category",
  chart: "bar",
  sort: "value_desc",
  limit: 10,
  filters: { dateShortcut: "month", txType: "expense" },
};

export default function CustomReportBuilder() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📊");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<ReportConfig>(emptyConfig);
  const [saving, setSaving] = useState(false);

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

  const canNext = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    return true;
  }, [step, name]);

  const save = async () => {
    if (!name.trim()) { toast.error("Give your report a name"); setStep(0); return; }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isNew ? "New custom report" : "Edit report"}</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/finance/reports/custom")}>Cancel</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              i === step ? "bg-primary text-primary-foreground border-primary" :
              i < step ? "bg-primary-soft text-primary border-primary/30" :
              "bg-card text-muted-foreground"
            }`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Step panel */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{STEPS[step]}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="flex gap-2">
                  <div className="w-20">
                    <Label>Icon</Label>
                    <Input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} className="text-center text-2xl" />
                  </div>
                  <div className="flex-1">
                    <Label>Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="My spending vs last month" />
                  </div>
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    placeholder="What is this report for? Who is it for?" />
                </div>
              </>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <Label>Data source</Label>
                <Select value={config.source} onValueChange={(v: ReportSource) => setConfig(c => ({ ...c, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactions">Transactions</SelectItem>
                    <SelectItem value="budgets">Budgets</SelectItem>
                    <SelectItem value="savings">Savings contributions</SelectItem>
                    <SelectItem value="recurring">Recurring rules</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Transactions gives you the richest filters. Other sources use the same builder.</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <Label>What to measure</Label>
                <Select value={config.metric} onValueChange={(v: ReportMetric) => setConfig(c => ({ ...c, metric: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METRIC_LABEL) as ReportMetric[]).map(k =>
                      <SelectItem key={k} value={k}>{METRIC_LABEL[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Group by</Label>
                  <Select value={config.groupBy} onValueChange={(v: ReportGroupBy) => setConfig(c => ({ ...c, groupBy: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GROUP_LABEL) as ReportGroupBy[]).map(k =>
                        <SelectItem key={k} value={k}>{GROUP_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {config.source === "transactions" && (
                  <>
                    <div className="space-y-2">
                      <Label>Date range</Label>
                      <Select value={config.filters?.dateShortcut || "month"}
                        onValueChange={(v: any) => updateFilters({ dateShortcut: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This week</SelectItem>
                          <SelectItem value="month">This month</SelectItem>
                          <SelectItem value="quarter">This quarter</SelectItem>
                          <SelectItem value="year">This year</SelectItem>
                          <SelectItem value="all">All time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Transaction type</Label>
                      <Select value={config.filters?.txType || "all"}
                        onValueChange={(v: any) => updateFilters({ txType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All types</SelectItem>
                          <SelectItem value="income">Income only</SelectItem>
                          <SelectItem value="expense">Expenses only</SelectItem>
                          <SelectItem value="transfer">Transfers only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Search description</Label>
                      <Input value={config.filters?.search || ""} onChange={e => updateFilters({ search: e.target.value })}
                        placeholder="Optional keyword" />
                    </div>
                  </>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label>Chart type</Label>
                  <Select value={config.chart} onValueChange={(v: ReportChart) => setConfig(c => ({ ...c, chart: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CHART_LABEL) as ReportChart[]).map(k =>
                        <SelectItem key={k} value={k}>{CHART_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Sort</Label>
                    <Select value={config.sort || "value_desc"} onValueChange={(v: any) => setConfig(c => ({ ...c, sort: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value_desc">Value (high → low)</SelectItem>
                        <SelectItem value="value_asc">Value (low → high)</SelectItem>
                        <SelectItem value="label_asc">Label (A → Z)</SelectItem>
                        <SelectItem value="label_desc">Label (Z → A)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Show top</Label>
                    <Input type="number" min={1} max={50} value={config.limit ?? 10}
                      onChange={e => setConfig(c => ({ ...c, limit: Math.max(1, Number(e.target.value) || 10) }))} />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between pt-3 border-t">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save report</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-xl">{emoji}</span> {name || "Live preview"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReportRenderer config={config} height={360} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
