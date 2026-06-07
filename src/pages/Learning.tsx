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
import { Plus, GraduationCap, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";

type Path = {
  id: string; title: string; topic: string | null; description: string | null;
  emoji: string | null; start_date: string | null; end_date: string | null;
  status: string; group_id: string | null; user_id: string;
};
type Group = { id: string; name: string; emoji: string | null };

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
    toast.success("Learning path created");
    setOpen(false);
    setForm({ title: "", topic: "", description: "", emoji: "📚", start_date: "", end_date: "", group_id: "personal" });
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
          <DialogContent>
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
              <Button onClick={create} className="w-full">Create path</Button>
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
