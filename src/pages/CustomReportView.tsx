import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pencil, Share2, Trash2, Pin, PinOff, Copy, ArrowLeft, Link2, X } from "lucide-react";
import { toast } from "sonner";
import ReportRenderer from "@/components/reports/ReportRenderer";
import { ReportConfig } from "@/lib/reportEngine";

export default function CustomReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data, error } = await (supabase as any).from("custom_reports").select("*").eq("id", id).maybeSingle();
    if (error) toast.error(error.message);
    setReport(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const remove = async () => {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    await (supabase as any).from("custom_reports").delete().eq("id", id);
    toast.success("Deleted"); navigate("/finance/reports/custom");
  };
  const togglePin = async () => {
    await (supabase as any).from("custom_reports").update({ is_pinned: !report.is_pinned }).eq("id", id);
    toast.success(report.is_pinned ? "Unpinned" : "Pinned to dashboard"); load();
  };
  const enableShare = async () => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await (supabase as any).from("custom_reports").update({ share_token: token }).eq("id", id);
    load(); toast.success("Share link created");
  };
  const revokeShare = async () => {
    await (supabase as any).from("custom_reports").update({ share_token: null, share_expires_at: null }).eq("id", id);
    load(); toast.success("Share link revoked");
  };
  const copyLink = () => {
    if (!report?.share_token) return;
    const url = `${window.location.origin}/r/${report.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  if (loading) return <div className="skeleton h-96" />;
  if (!report) return (
    <div className="text-center py-16">
      <div className="text-6xl mb-3">🔍</div>
      <p className="text-muted-foreground">Report not found.</p>
      <Button asChild variant="link"><Link to="/finance/reports/custom">← Back to reports</Link></Button>
    </div>
  );

  const cfg = report.config as ReportConfig;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/finance/reports/custom")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">{report.emoji}</span> {report.name}
              {report.is_pinned && <Badge variant="outline" className="text-[10px]"><Pin className="h-2.5 w-2.5 mr-1" /> Pinned</Badge>}
              {report.share_token && <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20"><Link2 className="h-2.5 w-2.5 mr-1" /> Shared</Badge>}
            </h1>
            {report.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{report.description}</p>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4 mr-1" /> Share</Button>
          <Button variant="outline" onClick={togglePin}>
            {report.is_pinned ? <><PinOff className="h-4 w-4 mr-1" /> Unpin</> : <><Pin className="h-4 w-4 mr-1" /> Pin</>}
          </Button>
          <Button variant="outline" asChild><Link to={`/finance/reports/custom/${id}/edit`}><Pencil className="h-4 w-4 mr-1" /> Edit</Link></Button>
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={remove}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportRenderer config={cfg} height={460} />
        </CardContent>
      </Card>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share this report</DialogTitle></DialogHeader>
          {report.share_token ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Anyone with this link can view a read-only copy.</p>
              <div className="flex gap-2">
                <Input readOnly value={`${window.location.origin}/r/${report.share_token}`} />
                <Button onClick={copyLink}><Copy className="h-4 w-4" /></Button>
              </div>
              <Button variant="ghost" className="text-danger hover:text-danger w-full" onClick={revokeShare}>
                <X className="h-4 w-4 mr-1" /> Revoke link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Generate a link you can send to anyone. They won't see any of your other data.</p>
              <Button className="w-full" onClick={enableShare}><Link2 className="h-4 w-4 mr-1" /> Create share link</Button>
            </div>
          )}
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
