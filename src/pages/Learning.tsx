import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap, Users, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Path = {
  id: string; title: string; topic: string | null; description: string | null;
  emoji: string | null; start_date: string | null; end_date: string | null;
  status: string; group_id: string | null; user_id: string;
};
type Group = { id: string; name: string; emoji: string | null };
type WeekDraft = { title: string; focus: string; start_date: string; end_date: string };

export default function Learning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetGroup = params.get("group");
  const [paths, setPaths] = useState<Path[]>([]);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", topic: "", description: "", emoji: "📚",
    start_date: "", end_date: "", group_id: presetGroup || "personal",
  });
  const [weeks, setWeeks] = useState<WeekDraft[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: pathsData } = await supabase.from("learning_paths").select("*").order("created_at", { ascending: false });
    setPaths((pathsData as any) || []);
    const ids = (pathsData || []).map((p: any) => p.id);
    if (ids.length) {
      const { data: periods } = await supabase.from("learning_periods").select("id,path_id,status").in("path_id", ids);
      const p: Record<string, { done: number; total: number }> = {};
      (periods || []).forEach((pe: any) => {
        p[pe.path_id] ||= { done: 0, total: 0 };
        p[pe.path_id].total++;
        if (pe.status === "done") p[pe.path_id].done++;
      });
      setProgress(p);
    }
    const { data: g } = await supabase.from("groups").select("id,name,emoji");
    setGroups((g as any) || []);
  };

  useEffect(() => { load(); }, [user]);

  const addWeek = () => setWeeks([...weeks, { title: "", focus: "", start_date: "", end_date: "" }]);
  const updateWeek = (i: number, patch: Partial<WeekDraft>) => setWeeks(weeks.map((w, idx) => idx === i ? { ...w, ...patch } : w));
  const removeWeek = (i: number) => setWeeks(weeks.filter((_, idx) => idx !== i));

  const create = async () => {
    if (!user || !form.title.trim()) return;
    const { data, error } = await supabase.from("learning_paths").insert({
      user_id: user.id,
      title: form.title.trim(),
      topic: form.topic || null,
      description: form.description || null,
      emoji: form.emoji || "📚",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      group_id: form.group_id === "personal" ? null : form.group_id,
    }).select().single();
    if (error) { toast.error(error.message); return; }

    // Bulk insert weeks if any
    const validWeeks = weeks.filter(w => w.title.trim());
    if (validWeeks.length) {
      const rows = validWeeks.map((w, i) => ({
        path_id: data!.id, user_id: user.id, week_number: i + 1,
        title: w.title.trim(), focus: w.focus || null,
        start_date: w.start_date || null, end_date: w.end_date || null,
      }));
      const { error: pe } = await supabase.from("learning_periods").insert(rows);
      if (pe) toast.error("Weeks: " + pe.message);
    }

    toast.success("Learning path created");
    setOpen(false);
    setForm({ title: "", topic: "", description: "", emoji: "📚", start_date: "", end_date: "", group_id: "personal" });
    setWeeks([]);
    navigate(`/learning/${data!.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-primary" /> Learning</h1>
          <p className="text-muted-foreground">Plan what to learn, track weekly progress, and reflect on what you took away.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Path</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New learning path</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input className="w-20" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} placeholder="📚" />
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mobile App Development" />
              </div>
              <Input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Topic / category (Android, ML, ...)" />
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What do you want to achieve?" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted-foreground">Start</label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">End</label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Scope</label>
                <Select value={form.group_id} onValueChange={v => setForm({ ...form, group_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Weekly plan</div>
                    <div className="text-xs text-muted-foreground">Sketch the weeks now (you can add more later).</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={addWeek}><Plus className="h-3 w-3 mr-1" /> Add week</Button>
                </div>
                {weeks.map((w, i) => (
                  <div key={i} className="rounded border p-2 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Week {i + 1}</Badge>
                      <Input className="flex-1" value={w.title} onChange={e => updateWeek(i, { title: e.target.value })} placeholder="Week title (e.g. Explore Android ecosystem)" />
                      <Button size="icon" variant="ghost" onClick={() => removeWeek(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Input value={w.focus} onChange={e => updateWeek(i, { focus: e.target.value })} placeholder="Focus / outcome" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={w.start_date} onChange={e => updateWeek(i, { start_date: e.target.value })} />
                      <Input type="date" value={w.end_date} onChange={e => updateWeek(i, { end_date: e.target.value })} />
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={create} className="w-full">Create path{weeks.filter(w => w.title.trim()).length ? ` + ${weeks.filter(w => w.title.trim()).length} weeks` : ""}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {paths.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No learning paths yet. Create one to start tracking weeks, deliverables and reflections.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paths.map(p => {
            const pr = progress[p.id] || { done: 0, total: 0 };
            const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
            const groupName = p.group_id ? groups.find(g => g.id === p.group_id)?.name : null;
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/learning/${p.id}`)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-2xl">{p.emoji}</span> {p.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 flex-wrap">
                    {p.topic && <Badge variant="secondary">{p.topic}</Badge>}
                    {groupName && <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{groupName}</Badge>}
                    <Badge>{p.status}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="text-xs text-muted-foreground">{pr.done}/{pr.total} weeks complete</div>
                  <Progress value={pct} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
