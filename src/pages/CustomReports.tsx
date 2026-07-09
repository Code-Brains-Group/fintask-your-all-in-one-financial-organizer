import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, BarChart3, PieChart as PieIcon, Wallet, Trash2, Copy, Pin, PinOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { ReportConfig } from "@/lib/reportEngine";

const TEMPLATES: { name: string; emoji: string; description: string; config: ReportConfig }[] = [
  {
    name: "My top spending categories",
    emoji: "🔥",
    description: "See where your money is going this month.",
    config: { source: "transactions", metric: "sum_amount", groupBy: "category", chart: "bar",
      sort: "value_desc", limit: 10, filters: { dateShortcut: "month", txType: "expense" } },
  },
  {
    name: "Monthly cashflow",
    emoji: "💵",
    description: "Net income minus expenses month-by-month.",
    config: { source: "transactions", metric: "net", groupBy: "month", chart: "area",
      sort: "label_asc", filters: { dateShortcut: "year" } },
  },
  {
    name: "Wallet health",
    emoji: "👛",
    description: "Total spending grouped by wallet.",
    config: { source: "transactions", metric: "sum_amount", groupBy: "wallet", chart: "pie",
      sort: "value_desc", filters: { dateShortcut: "month", txType: "expense" } },
  },
];

export default function CustomReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("custom_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const createFromTemplate = async (t: typeof TEMPLATES[number]) => {
    const { data, error } = await (supabase as any).from("custom_reports").insert({
      user_id: user!.id, name: t.name, emoji: t.emoji, description: t.description, config: t.config,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Report created");
    navigate(`/finance/reports/custom/${data.id}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await (supabase as any).from("custom_reports").delete().eq("id", id);
    load();
  };
  const duplicate = async (r: any) => {
    await (supabase as any).from("custom_reports").insert({
      user_id: user!.id, name: `${r.name} (copy)`, emoji: r.emoji,
      description: r.description, config: r.config,
    });
    toast.success("Duplicated"); load();
  };
  const togglePin = async (r: any) => {
    await (supabase as any).from("custom_reports").update({ is_pinned: !r.is_pinned }).eq("id", r.id);
    toast.success(r.is_pinned ? "Unpinned from dashboard" : "Pinned to dashboard");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Custom reports</h1>
          <p className="text-sm text-muted-foreground">Build reports that answer your own questions.</p>
        </div>
        <Button asChild><Link to="/finance/reports/custom/new"><Plus className="h-4 w-4 mr-1" /> New report</Link></Button>
      </div>

      {loading ? (
        <div className="skeleton h-48" />
      ) : reports.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start with a template</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {TEMPLATES.map(t => (
              <button key={t.name} onClick={() => createFromTemplate(t)}
                className="text-left rounded-xl border p-4 hover:border-primary hover:bg-primary-soft/40 transition-colors">
                <div className="text-3xl">{t.emoji}</div>
                <div className="font-semibold mt-2">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
              </button>
            ))}
            <Link to="/finance/reports/custom/new"
              className="rounded-xl border-2 border-dashed p-4 grid place-items-center text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <div className="text-center">
                <Plus className="h-6 w-6 mx-auto mb-1" />
                Build from scratch
              </div>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reports.map(r => (
            <Card key={r.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{r.emoji}</span>
                    <div>
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      {r.is_pinned && <Badge variant="outline" className="mt-1 text-[10px]"><Pin className="h-2.5 w-2.5 mr-1" /> Pinned</Badge>}
                    </div>
                  </div>
                  <ChartIcon type={r.config?.chart} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">{r.config?.source}</Badge>
                  <Badge variant="secondary" className="text-[10px]">by {r.config?.groupBy}</Badge>
                </div>
                <div className="flex gap-1 pt-2 border-t">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => navigate(`/finance/reports/custom/${r.id}`)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Open
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePin(r)} title={r.is_pinned ? "Unpin" : "Pin to dashboard"}>
                    {r.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(r)} title="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)} title="Delete" className="text-danger hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartIcon({ type }: { type?: string }) {
  const Icon = type === "pie" ? PieIcon : type === "stat" ? Wallet : BarChart3;
  return <Icon className="h-5 w-5 text-muted-foreground" />;
}
