import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReportRenderer from "@/components/reports/ReportRenderer";
import { ReportConfig } from "@/lib/reportEngine";

export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("get_shared_report", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      setReport(row || null);
      // Shared views can't see the owner's raw data — render with empty dataset placeholder
      setRows([]);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen grid place-items-center"><div className="skeleton h-64 w-full max-w-2xl" /></div>;
  if (!report) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <div className="text-6xl mb-3">🔒</div>
        <h1 className="text-2xl font-bold">This link is not valid</h1>
        <p className="text-muted-foreground mt-2">The report may have been revoked or expired.</p>
      </div>
    </div>
  );

  const cfg = report.config as ReportConfig;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground font-bold">F</div>
            <span className="font-semibold">FinTask</span>
          </div>
          <div className="text-xs text-muted-foreground">Shared by {report.owner_name}</div>
        </div>
      </header>
      <main className="container max-w-5xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span>{report.emoji}</span> {report.name}
          </h1>
          {report.description && <p className="text-muted-foreground mt-2 max-w-2xl">{report.description}</p>}
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Report</CardTitle></CardHeader>
          <CardContent>
            <ReportRenderer config={cfg} height={460} rowsOverride={rows || []} lookupsOverride={{ categories: [], wallets: [] }} />
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Shared reports show the report layout only — the underlying data stays private to the owner.
            </p>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground pt-4">
          Made with <a href="/" className="text-primary hover:underline">FinTask</a>
        </p>
      </main>
    </div>
  );
}
