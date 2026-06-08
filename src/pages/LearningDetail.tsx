import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Plus, CheckCircle2, MessageSquare, Trash2, Star, Users, Crown, ListTodo } from "lucide-react";
import { toast } from "sonner";

type Path = { id: string; title: string; topic: string | null; description: string | null; emoji: string | null; status: string; group_id: string | null; user_id: string; start_date: string | null; end_date: string | null; };
type Period = { id: string; week_number: number; title: string; focus: string | null; start_date: string | null; end_date: string | null; status: string; completed_at: string | null; };
type Deliverable = { id: string; period_id: string; title: string; done: boolean; task_id: string | null; user_id: string; };
type Reflection = { id: string; period_id: string | null; deliverable_id: string | null; user_id: string; learned: string | null; challenges: string | null; next_steps: string | null; rating: number | null; created_at: string; };
type ReflectTarget = { type: "path" } | { type: "period"; periodId: string } | { type: "deliverable"; deliverableId: string; periodId: string };

export default function LearningDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [path, setPath] = useState<Path | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [groupMembers, setGroupMembers] = useState<{ user_id: string; role: string; display_name: string | null }[]>([]);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({ week_number: 1, title: "", focus: "", start_date: "", end_date: "" });

  const [reflectTarget, setReflectTarget] = useState<ReflectTarget | null>(null);
  const [reflectForm, setReflectForm] = useState({ learned: "", challenges: "", next_steps: "", rating: 4, period_id: "" });

  const [delTitle, setDelTitle] = useState<Record<string, string>>({});

  const isOwner = user && path && user.id === path.user_id;

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

    // member names + group roster
    const groupId = (p as any)?.group_id;
    let roster: any[] = [];
    if (groupId) {
      const { data: gm } = await supabase.from("group_members").select("user_id,role,display_name").eq("group_id", groupId);
      roster = gm || [];
      setGroupMembers(roster);
    } else setGroupMembers([]);

    const uids = Array.from(new Set([
      ...(r || []).map((x: any) => x.user_id),
      (p as any)?.user_id,
      ...roster.map((m: any) => m.user_id),
    ].filter(Boolean)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", uids);
      const m: Record<string, string> = {};
      (profs || []).forEach((x: any) => m[x.id] = x.display_name || "Member");
      roster.forEach((x: any) => { if (x.display_name && !m[x.user_id]) m[x.user_id] = x.display_name; });
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

  // Mirror a deliverable into Tasks so it shows up in /tasks
  const mirrorTaskFor = async (period: Period, deliverableId: string, title: string) => {
    if (!user || !path) return null;
    const labels = ["learning", `path:${path.title}`.slice(0, 60), `week:${period.week_number}`];
    const { data, error } = await supabase.from("tasks").insert({
      user_id: user.id,
      group_id: path.group_id,
      title: `📚 ${title}`,
      description: `Learning deliverable · ${path.title} · Week ${period.week_number}: ${period.title}`,
      status: "todo",
      priority: "medium",
      due_date: period.end_date ? new Date(period.end_date).toISOString() : null,
      labels,
    }).select("id").single();
    if (error) { console.warn("mirror task failed", error); return null; }
    await supabase.from("learning_deliverables").update({ task_id: data!.id }).eq("id", deliverableId);
    return data!.id;
  };

  const addDeliverable = async (period: Period) => {
    const title = (delTitle[period.id] || "").trim();
    if (!title || !user) return;
    const { data, error } = await supabase.from("learning_deliverables").insert({
      period_id: period.id, user_id: user.id, title,
    }).select().single();
    if (error) return toast.error(error.message);
    await mirrorTaskFor(period, data!.id, title);
    setDelTitle({ ...delTitle, [period.id]: "" });
    load();
  };

  const toggleDeliverable = async (d: Deliverable) => {
    const newDone = !d.done;
    await supabase.from("learning_deliverables")
      .update({ done: newDone, done_at: newDone ? new Date().toISOString() : null })
      .eq("id", d.id);
    if (d.task_id) {
      await supabase.from("tasks").update({
        status: newDone ? "done" : "todo",
        completed_at: newDone ? new Date().toISOString() : null,
      }).eq("id", d.task_id);
    }
    load();
  };

  const removeDeliverable = async (d: Deliverable) => {
    if (d.task_id) await supabase.from("tasks").delete().eq("id", d.task_id);
    await supabase.from("learning_deliverables").delete().eq("id", d.id);
    load();
  };

  const completePeriod = async (periodId: string) => {
    await supabase.from("learning_periods").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", periodId);
    setReflectTarget({ type: "period", periodId });
    setReflectForm({ learned: "", challenges: "", next_steps: "", rating: 4, period_id: periodId });
    load();
  };

  const openReflection = (target: ReflectTarget) => {
    setReflectTarget(target);
    const periodId = target.type === "period" ? target.periodId : target.type === "deliverable" ? target.periodId : "";
    setReflectForm({ learned: "", challenges: "", next_steps: "", rating: 4, period_id: periodId });
  };

  const saveReflection = async () => {
    if (!user || !id || !reflectTarget) return;
    const periodId = reflectTarget.type === "period" ? reflectTarget.periodId
      : reflectTarget.type === "deliverable" ? reflectTarget.periodId
      : (reflectForm.period_id || null);
    const deliverableId = reflectTarget.type === "deliverable" ? reflectTarget.deliverableId : null;
    const { error } = await supabase.from("learning_reflections").insert({
      path_id: id,
      period_id: periodId,
      deliverable_id: deliverableId,
      user_id: user.id,
      learned: reflectForm.learned || null,
      challenges: reflectForm.challenges || null,
      next_steps: reflectForm.next_steps || null,
      rating: reflectForm.rating,
    });
    if (error) return toast.error(error.message);
    toast.success("Reflection saved");
    setReflectTarget(null);
    load();
  };

  const completePath = async () => {
    if (!id) return;
    await supabase.from("learning_paths").update({ status: "completed" }).eq("id", id);
    openReflection({ type: "path" });
    setReflectForm(f => ({ ...f, rating: 5 }));
  };

  // Mentor view stats
  const mentorStats = useMemo(() => {
    if (!groupMembers.length) return [];
    return groupMembers.map(m => {
      const myRefs = reflections.filter(r => r.user_id === m.user_id);
      const periodsReflected = new Set(myRefs.filter(r => r.period_id).map(r => r.period_id));
      const lastActivity = myRefs[0]?.created_at;
      return {
        user_id: m.user_id,
        role: m.role,
        name: memberNames[m.user_id] || m.display_name || "Member",
        reflectionCount: myRefs.length,
        weeksReflected: periodsReflected.size,
        lastActivity,
      };
    }).sort((a, b) => b.reflectionCount - a.reflectionCount);
  }, [groupMembers, reflections, memberNames]);

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
                {path.group_id && <Badge variant="outline"><Users className="h-3 w-3 mr-1" /> Group</Badge>}
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
              {path.status !== "completed" && isOwner && (
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
          {path.group_id && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <ListTodo className="h-3 w-3" /> Deliverables added here also appear in everyone's Tasks list (tagged <code>learning</code>).
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Weekly plan</TabsTrigger>
          <TabsTrigger value="reflections">Reflections</TabsTrigger>
          {path.group_id && <TabsTrigger value="mentees"><Crown className="h-3 w-3 mr-1" /> Mentor view</TabsTrigger>}
        </TabsList>

        <TabsContent value="plan">
          <Card>
            <CardContent className="pt-6">
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
                            {items.map(d => {
                              const dRefs = reflections.filter(r => r.deliverable_id === d.id);
                              return (
                                <div key={d.id} className="rounded border bg-muted/30">
                                  <div className="flex items-center gap-2 p-2">
                                    <Checkbox checked={d.done} onCheckedChange={() => toggleDeliverable(d)} />
                                    <span className={`flex-1 text-sm ${d.done ? "line-through text-muted-foreground" : ""}`}>{d.title}</span>
                                    {d.task_id && <Badge variant="outline" className="text-[10px]"><ListTodo className="h-3 w-3 mr-1" />In tasks</Badge>}
                                    <Button variant="ghost" size="icon" title="Reflect on this deliverable" onClick={() => openReflection({ type: "deliverable", deliverableId: d.id, periodId: pe.id })}>
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => removeDeliverable(d)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                  {dRefs.map(r => (
                                    <div key={r.id} className="border-t bg-background px-3 py-2 text-xs space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{memberNames[r.user_id] || "Member"}</span>
                                        <div className="flex">{Array.from({ length: r.rating || 0 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}</div>
                                      </div>
                                      {r.learned && <p><strong>Learned:</strong> {r.learned}</p>}
                                      {r.challenges && <p><strong>Challenges:</strong> {r.challenges}</p>}
                                      {r.next_steps && <p><strong>Next:</strong> {r.next_steps}</p>}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            <div className="flex gap-2">
                              <Input
                                value={delTitle[pe.id] || ""}
                                onChange={e => setDelTitle({ ...delTitle, [pe.id]: e.target.value })}
                                onKeyDown={e => e.key === "Enter" && addDeliverable(pe)}
                                placeholder="Add a deliverable (also appears in Tasks)..."
                              />
                              <Button size="sm" onClick={() => addDeliverable(pe)}><Plus className="h-4 w-4" /></Button>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {pe.status !== "done" ? (
                              <Button size="sm" onClick={() => completePeriod(pe.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark week complete & reflect
                              </Button>
                            ) : (
                              <Badge variant="default">Completed</Badge>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openReflection({ type: "period", periodId: pe.id })}>
                              <MessageSquare className="h-4 w-4 mr-1" /> Add week reflection
                            </Button>
                          </div>
                          {reflections.filter(r => r.period_id === pe.id && !r.deliverable_id).map(r => (
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
        </TabsContent>

        <TabsContent value="reflections">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5" /> All reflections</CardTitle>
                <Button size="sm" variant="outline" onClick={() => openReflection({ type: "path" })}>
                  <Plus className="h-4 w-4 mr-1" /> Add reflection
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {reflections.length === 0 && <p className="text-sm text-muted-foreground">No reflections yet.</p>}
              {reflections.map(r => {
                const pe = periods.find(p => p.id === r.period_id);
                const d = r.deliverable_id ? deliverables.find(x => x.id === r.deliverable_id) : null;
                return (
                  <div key={r.id} className="p-3 rounded border space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{(memberNames[r.user_id] || "M")[0]}</AvatarFallback></Avatar>
                        <span className="text-xs font-medium">{memberNames[r.user_id] || "Member"}</span>
                        {pe && <Badge variant="secondary" className="text-[10px]">Week {pe.week_number}</Badge>}
                        {d && <Badge variant="outline" className="text-[10px]">📌 {d.title}</Badge>}
                        {!pe && !d && <Badge variant="outline" className="text-[10px]">Overall</Badge>}
                        <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex">{Array.from({ length: r.rating || 0 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-warning text-warning" />)}</div>
                    </div>
                    {r.learned && <p className="text-sm"><strong>Learned:</strong> {r.learned}</p>}
                    {r.challenges && <p className="text-sm"><strong>Challenges:</strong> {r.challenges}</p>}
                    {r.next_steps && <p className="text-sm"><strong>Next:</strong> {r.next_steps}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {path.group_id && (
          <TabsContent value="mentees">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Crown className="h-5 w-5 text-warning" /> Mentor view</CardTitle>
                <CardDescription>Track each mentee's engagement, weeks reflected on, and last activity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {mentorStats.length === 0 && <p className="text-sm text-muted-foreground">No group members yet.</p>}
                {mentorStats.map(s => {
                  const wp = totalPeriods ? Math.round((s.weeksReflected / totalPeriods) * 100) : 0;
                  return (
                    <div key={s.user_id} className="rounded border p-3 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8"><AvatarFallback>{s.name[0]}</AvatarFallback></Avatar>
                          <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                              {s.name}
                              {(s.role === "owner" || s.role === "admin") && <Badge variant="outline" className="text-[10px]"><Crown className="h-3 w-3 mr-1" />{s.role}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.reflectionCount} reflections · {s.weeksReflected}/{totalPeriods} weeks reflected
                              {s.lastActivity && ` · last ${new Date(s.lastActivity).toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Progress value={wp} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!reflectTarget} onOpenChange={o => !o && setReflectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reflectTarget?.type === "path" ? "Reflect on the path"
                : reflectTarget?.type === "deliverable" ? "Reflect on deliverable"
                : "Week reflection"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {reflectTarget?.type === "path" && periods.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground">Tie to a week (optional)</label>
                <Select value={reflectForm.period_id || "none"} onValueChange={v => setReflectForm({ ...reflectForm, period_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Overall (no week)</SelectItem>
                    {periods.map(pe => <SelectItem key={pe.id} value={pe.id}>Week {pe.week_number}: {pe.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {reflectTarget?.type === "deliverable" && (
              <p className="text-xs text-muted-foreground">
                On: <strong>{deliverables.find(d => d.id === (reflectTarget as any).deliverableId)?.title}</strong>
              </p>
            )}
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
