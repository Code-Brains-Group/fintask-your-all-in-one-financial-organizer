import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate } from "@/lib/finance";
import { buildICS, downloadICS, googleCalUrl, CalEvent } from "@/lib/ics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, ExternalLink, CalendarPlus, Download, GraduationCap, Briefcase, AlarmClock } from "lucide-react";
import { toast } from "sonner";

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  scholarship: { label: "Scholarship", icon: GraduationCap, color: "bg-primary-soft text-primary border-primary/30" },
  job:         { label: "Job",         icon: Briefcase,     color: "bg-warning-soft text-warning border-warning/30" },
};

const STATUSES = ["saved", "applied", "interview", "offer", "rejected", "accepted", "withdrawn"];
const STATUS_STYLES: Record<string, string> = {
  saved:     "bg-muted text-muted-foreground",
  applied:   "bg-primary-soft text-primary",
  interview: "bg-warning-soft text-warning",
  offer:     "bg-success-soft text-success",
  accepted:  "bg-success-soft text-success",
  rejected:  "bg-danger-soft text-danger",
  withdrawn: "bg-muted text-muted-foreground",
};

export default function Applications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("applications").select("*").eq("user_id", user.id).order("deadline", { ascending: true, nullsFirst: false });
    setItems(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => tab === "all" ? items : items.filter(i => i.kind === tab), [items, tab]);

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    for (const i of items) s[i.status] = (s[i.status] || 0) + 1;
    return s;
  }, [items]);

  const upcomingDeadlines = items.filter(i => i.deadline && new Date(i.deadline) >= new Date(new Date().setHours(0,0,0,0))).slice(0, 5);

  const remove = async (id: string) => {
    if (!confirm("Delete this application?")) return;
    await supabase.from("applications").delete().eq("id", id);
    toast.success("Deleted"); load();
  };

  const exportAllICS = () => {
    const events: CalEvent[] = items.flatMap((i: any) => {
      const list: CalEvent[] = [];
      if (i.deadline) list.push({
        id: `${i.id}-deadline`, title: `📅 Deadline: ${i.title}`,
        description: `${KIND_META[i.kind]?.label || i.kind} at ${i.organization || "—"}\n${i.notes || ""}`,
        start: new Date(i.deadline + "T09:00:00"), location: i.location || undefined, url: i.link || undefined,
      });
      if (i.reminder_at) list.push({
        id: `${i.id}-reminder`, title: `⏰ Reminder: ${i.title}`,
        description: i.notes || "", start: new Date(i.reminder_at),
      });
      return list;
    });
    if (!events.length) { toast.error("Nothing to export"); return; }
    downloadICS("fintask-applications.ics", buildICS(events, "FinTask Applications"));
    toast.success(`${events.length} event(s) exported`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" /> Applications</h1>
          <p className="text-muted-foreground text-sm">Track scholarships and job applications in one place</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportAllICS}><Download className="h-4 w-4 mr-1" /> Export to Calendar</Button>
          <AppSheet onSaved={load} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {STATUSES.map(s => (
          <div key={s} className={`rounded-xl border p-3 ${STATUS_STYLES[s]}`}>
            <div className="text-xs uppercase tracking-wide opacity-80">{s}</div>
            <div className="text-2xl font-bold">{stats[s] || 0}</div>
          </div>
        ))}
      </div>

      {upcomingDeadlines.length > 0 && (
        <Card className="border-warning/40 bg-warning-soft">
          <CardHeader><CardTitle className="text-base text-warning flex items-center gap-2"><AlarmClock className="h-4 w-4" /> Upcoming deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcomingDeadlines.map(i => {
              const days = Math.ceil((new Date(i.deadline).getTime() - Date.now()) / 86400000);
              return (
                <div key={i.id} className="flex items-center gap-3 bg-card border rounded-lg p-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{i.title} {i.organization && <span className="text-muted-foreground">· {i.organization}</span>}</div>
                    <div className="text-xs text-muted-foreground">Due {fmtDate(i.deadline)} · {days <= 0 ? "today" : `in ${days} day${days===1?"":"s"}`}</div>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLES[i.status]}>{i.status}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="scholarship">🎓 Scholarships</TabsTrigger>
          <TabsTrigger value="job">💼 Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-24" />)}</div>
          : filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <div className="text-5xl mb-3">🎯</div>
              <p className="text-muted-foreground mb-4">No applications yet — start tracking your opportunities</p>
              <AppSheet onSaved={load} />
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map(i => <AppCard key={i.id} item={i} onChange={load} onDelete={() => remove(i.id)} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppCard({ item, onChange, onDelete }: any) {
  const meta = KIND_META[item.kind] || KIND_META.job;
  const Icon = meta.icon;
  const ev: CalEvent | null = item.deadline ? {
    id: item.id, title: `${item.title} — Deadline`, description: item.notes || "",
    start: new Date(item.deadline + "T09:00:00"), location: item.location, url: item.link,
  } : null;

  const downloadOne = () => {
    if (!ev) { toast.error("Set a deadline first"); return; }
    downloadICS(`${item.title}.ics`, buildICS([ev]));
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${meta.color}`}><Icon className="h-4 w-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{item.title}</div>
            <div className="text-xs text-muted-foreground truncate">{item.organization || "—"} {item.location && `· ${item.location}`}</div>
          </div>
          <Badge variant="outline" className={STATUS_STYLES[item.status]}>{item.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.deadline && <span>📅 Due {fmtDate(item.deadline)}</span>}
          {item.applied_date && <span>✓ Applied {fmtDate(item.applied_date)}</span>}
          {item.amount && <span>💰 {fmtKES(item.amount)}</span>}
          {item.reminder_at && <span>⏰ {fmtDate(item.reminder_at)}</span>}
        </div>
        {item.notes && <div className="text-xs text-foreground/70 line-clamp-2">{item.notes}</div>}
        <div className="flex items-center gap-1 pt-1">
          {item.link && <Button asChild size="sm" variant="ghost"><a href={item.link} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" />Open</a></Button>}
          {ev && <>
            <Button asChild size="sm" variant="ghost"><a href={googleCalUrl(ev)} target="_blank" rel="noreferrer"><CalendarPlus className="h-3.5 w-3.5 mr-1" />Google</a></Button>
            <Button size="sm" variant="ghost" onClick={downloadOne}><Download className="h-3.5 w-3.5 mr-1" />.ics</Button>
          </>}
          <div className="flex-1" />
          <AppSheet item={item} onSaved={onChange} trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>} />
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AppSheet({ item, onSaved, trigger }: { item?: any; onSaved: () => void; trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});

  useEffect(() => {
    if (open) setF(item ? { ...item } : { kind: "job", status: "saved", title: "" });
  }, [open, item]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.title) { toast.error("Title required"); return; }
    const payload = {
      kind: f.kind, title: f.title, organization: f.organization || null,
      status: f.status, deadline: f.deadline || null, applied_date: f.applied_date || null,
      link: f.link || null, amount: f.amount ? Number(f.amount) : null,
      location: f.location || null, contact: f.contact || null, notes: f.notes || null,
      reminder_at: f.reminder_at ? new Date(f.reminder_at).toISOString() : null,
    };
    const res = item
      ? await supabase.from("applications").update(payload).eq("id", item.id)
      : await supabase.from("applications").insert({ ...payload, user_id: user!.id });
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(item ? "Updated" : "Application added");
    setOpen(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger || <Button><Plus className="h-4 w-4 mr-1" /> New application</Button>}</SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{item ? "Edit application" : "New application"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={f.kind} onValueChange={(v) => set("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">💼 Job</SelectItem>
                  <SelectItem value="scholarship">🎓 Scholarship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Title / Role</Label><Input value={f.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Software Engineer / MasterCard Foundation" /></div>
          <div><Label>Organization</Label><Input value={f.organization || ""} onChange={(e) => set("organization", e.target.value)} placeholder="e.g. Google, University of Nairobi" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Deadline</Label><Input type="date" value={f.deadline || ""} onChange={(e) => set("deadline", e.target.value)} /></div>
            <div><Label>Applied on</Label><Input type="date" value={f.applied_date || ""} onChange={(e) => set("applied_date", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount / Stipend (KES)</Label><Input type="number" value={f.amount || ""} onChange={(e) => set("amount", e.target.value)} placeholder="Optional" /></div>
            <div><Label>Location</Label><Input value={f.location || ""} onChange={(e) => set("location", e.target.value)} placeholder="Remote / Nairobi" /></div>
          </div>
          <div><Label>Link</Label><Input type="url" value={f.link || ""} onChange={(e) => set("link", e.target.value)} placeholder="https://…" /></div>
          <div><Label>Contact</Label><Input value={f.contact || ""} onChange={(e) => set("contact", e.target.value)} placeholder="recruiter@..." /></div>
          <div><Label>Reminder (notify 30 min before)</Label>
            <Input type="datetime-local" value={f.reminder_at ? new Date(f.reminder_at).toISOString().slice(0,16) : ""} onChange={(e) => set("reminder_at", e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea rows={3} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
          <Button className="w-full" onClick={submit}>{item ? "Save changes" : "Add application"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
