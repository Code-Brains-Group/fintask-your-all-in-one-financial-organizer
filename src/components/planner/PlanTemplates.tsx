import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookmarkPlus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

export type TemplateItem = { category_id: string | null; label: string; percent: number; amount: number };
export type PlanTemplate = { id: string; name: string; emoji: string; strategy: string; items: TemplateItem[] };

type Props = {
  currentRows: TemplateItem[];
  strategy: "amount" | "percent";
  earnings: number;
  catLabel: (id: string | null) => string;
  onApply: (items: TemplateItem[], strategy: "amount" | "percent") => void;
};

export default function PlanTemplates({ currentRows, strategy, earnings, catLabel, onApply }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🧧");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("plan_templates" as any).select("*").eq("user_id", user.id).order("created_at");
    setTemplates(((data || []) as any[]).map((t) => ({ ...t, items: (t.items || []) as TemplateItem[] })));
  };
  useEffect(() => { load(); }, [user]);

  const saveTemplate = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Give the template a name"); return; }
    if (!currentRows.length) { toast.error("Add a few envelopes first"); return; }
    setSaving(true);
    const items: TemplateItem[] = currentRows.map((r) => ({
      category_id: r.category_id,
      label: r.label || "",
      percent: strategy === "percent" ? r.percent || 0 : earnings ? ((r.amount || 0) / earnings) * 100 : 0,
      amount: strategy === "percent" ? (earnings * (r.percent || 0)) / 100 : r.amount || 0,
    }));
    const { error } = await supabase.from("plan_templates" as any)
      .insert({ user_id: user.id, name: name.trim(), emoji: emoji || "🧧", strategy, items } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setName("");
    toast.success("Template saved — apply it to any month in one click");
    load();
  };

  const remove = async (t: PlanTemplate) => {
    if (!confirm(`Delete the template "${t.name}"?`)) return;
    await supabase.from("plan_templates" as any).delete().eq("id", t.id);
    toast.success("Template deleted");
    load();
  };

  const apply = (t: PlanTemplate) => {
    const mode = (t.strategy === "percent" ? "percent" : "amount") as "amount" | "percent";
    const items = t.items.map((i) => ({
      ...i,
      amount: mode === "percent" ? (earnings * (i.percent || 0)) / 100 : i.amount,
    }));
    onApply(items, mode);
    toast.success(`"${t.name}" applied — remember to save the plan`);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Saved templates</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Save the split you're using now (like 50/30/20 or your own rules) and reuse it on any future month.</p>
        <div className="flex flex-wrap gap-2">
          <Input className="w-16" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🧧" />
          <Input className="flex-1 min-w-[160px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name e.g. My 50/30/20" />
          <Button onClick={saveTemplate} disabled={saving}><BookmarkPlus className="h-4 w-4 mr-1" /> Save current split</Button>
        </div>
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📐</div>
            <p className="text-sm text-muted-foreground">No templates yet — build a split above, then save it here.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => {
              const total = t.items.reduce((s, i) => s + (t.strategy === "percent" ? i.percent || 0 : i.amount || 0), 0);
              return (
                <div key={t.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.emoji} {t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.items.length} envelope{t.items.length === 1 ? "" : "s"} · {t.strategy === "percent" ? `${Math.round(total)}% allocated` : "fixed amounts"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => apply(t)}>Apply</Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.items.slice(0, 5).map((i, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px]">
                        {i.label || catLabel(i.category_id)} {t.strategy === "percent" ? `${Math.round(i.percent)}%` : ""}
                      </Badge>
                    ))}
                    {t.items.length > 5 && <Badge variant="outline" className="text-[10px]">+{t.items.length - 5}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
