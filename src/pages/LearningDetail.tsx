import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Plus, CheckCircle2, MessageSquare, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

type Path = { id: string; title: string; topic: string | null; description: string | null; emoji: string | null; status: string; group_id: string | null; user_id: string; start_date: string | null; end_date: string | null; };
type Period = { id: string; week_number: number; title: string; focus: string | null; start_date: string | null; end_date: string | null; status: string; completed_at: string | null; };
type Deliverable = { id: string; period_id: string; title: string; done: boolean; };
type Reflection = { id: string; period_id: string | null; user_id: string; learned: string | null; challenges: string | null; next_steps: string | null; rating: number | null; created_at: string; };

export default function LearningDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [path, setPath] = useState<Path | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({ week_number: 1, title: "", focus: "", start_date: "", end_date: "" });

  const [reflectOpen, setReflectOpen] = useState<string | null>(null); // period id or "path"
  const [reflectForm, setReflectForm] = useState({ learned: "", challenges: "", next_steps: "", rating: 4 });

  const [delTitle, setDelTitle] = useState<Record<string, string>>({});

  const load = async () => {
    if (!id) return;
    const { data: p } = await supabase.from("learning_paths").select("*").eq("id", id).maybeSingle();
    setPath(p as any);
    const { data: pe } = await supabase.from("learning_periods").select("*").eq("path_id", id).order("week_number");
    setPeriods((pe as any) || []);
    const periodIds = (pe || []).map((x: any) => x.id);
    if (periodIds.length) {
      const { data: d } = await supabase.from("learning_deliverables").select("*").in("period_id", periodIds);
      setDeliverables((d as any) || []);
    } else setDeliverables([]);
    const { data: r } = await supabase.from("learning_reflections").select("*").eq("path_id", id).order("created_at", { ascending: false });
    setReflections((r as any) || []);
    // member names
    const uids = Array.from(new Set([...(r || []).map((x: any) => x.user_id), (p as any)?.user_id].filter(Boolean)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", uids);
      const m: Record<string, string> = {};
      (profs || []).forEach((x: any) => m[x.id] = x.display_name || "Member");
      setMemberNames(m);
    }
    setPeriodForm(f => ({ ...f, week_number: (pe?.length || 0) + 1 }));
  };

  useEffect(() => { load(); }, [id]);

  const addPeriod = async () => {
    if (!user || !id || !periodForm.title.trim()) return;
    const { error } = await supabase.from("learning_periods").insert({
      path_id: id, user_id: user.id,
      week_number: periodForm.week_number,
      title: periodForm.title.trim(),
      focus: periodForm.focus || null,
      start_date: periodForm.start_date || null,
      end_date: periodForm.end_date || null,
    });
    if (error) { toast.error(error.message); return; }
    setPeriodOpen(false);
    setPeriodForm({ week_number: periods.length + 2, title: "", focus: "", start_date: "", end_date: "" });
    load();
  };

  const addDeliverable = async (periodId: string) => {
    const title = (delTitle[periodId] || "").trim();
    if (!title || !user) return;
    const { error } = await supabase.from("learning_deliverables").insert({
      period_id: periodId, user_id: user.id, title,
    });
    if (error) return toast.error(error.message);
    setDelTitle({ ...delTitle, [periodId]: "" });
    load();
  };

  const toggleDeliverable = async (d: Deliverable) => {
    await supabase.from("learning_deliverables")
      .update({ done: !d.done, done_at: !d.done ? new Date().toISOString() : null })
      .eq("id", d.id);
    load();
  };

  const removeDeliverable = async (dId: string) => {
    await supabase.from("learning_deliverables").delete().eq("id", dId);
    load();
  };

  const completePeriod = async (periodId: string) => {
    await supabase.from("learning_periods").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", periodId);
    setReflectOpen(periodId);
    setReflectForm({ learned: "", challenges: "", next_steps: "", rating: 4 });
    load();
  };

  const saveReflection = async () => {
    if (!user || !id) return;
    const { error } = await supabase.from("learning_reflections").insert({
      path_id: id,
      period_id: reflectOpen === "path" ? null : reflectOpen,
      user_id: user.id,
      learned: reflectForm.learned || null,
      challenges: reflectForm.challenges || null,
      next_steps: reflectForm.next_steps || null,
      rating: reflectForm.rating,
    });
    if (error) return toast.error(error.message);
    toast.success("Reflection saved");
    setReflectOpen(null);
    load();
  };

  const completePath = async () => {
    if (!id) return;
    await supabase.from("learning_paths").update({ status: "completed" }).eq("id", id);
    setReflectOpen("path");
    setReflectForm({ learned: "", challenges: "", next_steps: "", rating: 5 });
    load();
  };

  if (!path) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  const totalPeriods = periods.length;
  const donePeriods = periods.filter(p => p.status === "done").length;
  const pct = totalPeriods ? Math.round((donePeriods / totalPeriods) * 100) : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <span className="text-3xl">{path.emoji}</span> {path.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                {path.topic && <Badge variant="secondary">{path.topic}</Badge>}
                <Badge>{path.status}</Badge>
                {path.start_date && <span className="text-xs">{path.start_date} → {path.end_date || "…"}</span>}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add week</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add learning period</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="text-xs text-muted-foreground">Week #</label><Input type="number" value={periodForm.week_number} onChange={e => setPeriodForm({ ...periodForm, week_number: +e.target.value })} /></div>
                      <div className="col-span-2"><label className="text-xs text-muted-foreground">Title</label><Input value={periodForm.title} onChange={e => setPeriodForm({ ...periodForm, title: e.target.value })} placeholder="Explore Android ecosystem" /></div>
                    </div>
                    <Input value={periodForm.focus} onChange={e => setPeriodForm({ ...periodForm, focus: e.target.value })} placeholder="Focus area" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={periodForm.start_date} onChange={e => setPeriodForm({ ...periodForm, start_date: e.target.value })} />
                      <Input type="date" value={periodForm.end_date} onChange={e => setPeriodForm({ ...periodForm, end_date: e.target.value })} />
                    </div>
                    <Button onClick={addPeriod} className="w-full">Add week</Button>
                  </div>
                </DialogContent>
              </Dialog>
              {path.status !== "completed" && (
                <Button size="sm" onClick={completePath}><CheckCircle2 className="h-4 w-4 mr-1" /> Complete path</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {path.description && <p className="text-muted-foreground mb-3">{path.description}</p>}
          <div className="flex items-center gap-3">
            <Progress value={pct} className="flex-1" />
            <span className="text-sm font-medium">{donePeriods}/{totalPeriods} weeks</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Weekly plan</CardTitle></CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No weeks yet. Add your first week to get started.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {periods.map(pe => {
                const items = deliverables.filter(d => d.period_id === pe.id);
                const doneCount = items.filter(d => d.done).length;
                const pPct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
                return (
                  <AccordionItem key={pe.id} value={pe.id}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3 w-full pr-4">
                        <Badge variant={pe.status === "done" ? "default" : "secondary"}>Week {pe.week_number}</Badge>
                        <span className="font-medium text-left flex-1">{pe.title}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{doneCount}/{items.length}</span>
                        <div className="w-24 hidden sm:block"><Progress value={pPct} /></div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {pe.focus && <p className="text-sm text-muted-foreground">Focus: {pe.focus}</p>}
                      <div className="space-y-2">
                        {items.map(d => (
                          <div key={d.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                            <Checkbox checked={d.done} onCheckedChange={() => toggleDeliverable(d)} />
                            <span className={`flex-1 text-sm ${d.done ? "line-through text-muted-foreground" : ""}`}>{d.title}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeDeliverable(d.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            value={delTitle[pe.id] || ""}
                            onChange={e => setDelTitle({ ...delTitle, [pe.id]: e.target.value })}
                            onKeyDown={e => e.key === "Enter" && addDeliverable(pe.id)}
                            placeholder="Add a deliverable..."
                          />
                          <Button size="sm" onClick={() => addDeliverable(pe.id)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {pe.status !== "done" ? (
                          <Button size="sm" onClick={() => completePeriod(pe.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark week complete & reflect
                          </Button>
                        ) : (
                          <>
                            <Badge variant="default">Completed</Badge>
                            <Button size="sm" variant="outline" onClick={() => { setReflectOpen(pe.id); setReflectForm({ learned: "", challenges: "", next_steps: "", rating: 4 }); }}>
                              <MessageSquare className="h-4 w-4 mr-1" /> Add reflection
                            </Button>
                          </>
                        )}
                      </div>
                      {reflections.filter(r => r.period_id === pe.id).map(r => (
                        <div key={r.id} className="p-3 rounded border bg-background space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{memberNames[r.user_id] || "Member"}</span>
                            <div className="flex">{Array.from({ length: r.rating || 0 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}</div>
                          </div>
                          {r.learned && <p className="text-sm"><strong>Learned:</strong> {r.learned}</p>}
                          {r.challenges && <p className="text-sm"><strong>Challenges:</strong> {r.challenges}</p>}
                          {r.next_steps && <p className="text-sm"><strong>Next:</strong> {r.next_steps}</p>}
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Path reflections</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setReflectOpen("path"); setReflectForm({ learned: "", challenges: "", next_steps: "", rating: 5 }); }}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {reflections.filter(r => !r.period_id).length === 0 && <p className="text-sm text-muted-foreground">No overall reflections yet.</p>}
          {reflections.filter(r => !r.period_id).map(r => (
            <div key={r.id} className="p-3 rounded border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{memberNames[r.user_id] || "Member"} · {new Date(r.created_at).toLocaleDateString()}</span>
                <div className="flex">{Array.from({ length: r.rating || 0 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}</div>
              </div>
              {r.learned && <p className="text-sm"><strong>Learned:</strong> {r.learned}</p>}
              {r.challenges && <p className="text-sm"><strong>Challenges:</strong> {r.challenges}</p>}
              {r.next_steps && <p className="text-sm"><strong>Next:</strong> {r.next_steps}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!reflectOpen} onOpenChange={o => !o && setReflectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{reflectOpen === "path" ? "Reflect on the path" : "Week reflection"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">What did you learn?</label>
              <Textarea value={reflectForm.learned} onChange={e => setReflectForm({ ...reflectForm, learned: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Challenges</label>
              <Textarea value={reflectForm.challenges} onChange={e => setReflectForm({ ...reflectForm, challenges: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Next steps</label>
              <Textarea value={reflectForm.next_steps} onChange={e => setReflectForm({ ...reflectForm, next_steps: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setReflectForm({ ...reflectForm, rating: n })}>
                    <Star className={`h-6 w-6 ${n <= reflectForm.rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={saveReflection} className="w-full">Save reflection</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
