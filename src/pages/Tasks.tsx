import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtKES, fmtDate, TASK_STATUS_STYLES } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Trash2, KanbanSquare, ListTodo, BarChart3, Pencil, CalendarPlus, Download,
  ChevronDown, X, Users, CheckCircle2, Circle,
} from "lucide-react";
import { toast } from "sonner";
import { buildICS, downloadICS, googleCalUrl } from "@/lib/ics";
import { Link, useLocation } from "react-router-dom";
import {
  DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format, isSameDay, addDays, startOfDay, startOfWeek, endOfWeek } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-danger-soft text-danger border-danger/30",
  medium: "bg-warning-soft text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

type DateBucket = "overdue" | "today" | "tomorrow" | "yesterday" | "thisweek" | "later" | "nodate" | "completed";
const BUCKET_LABEL: Record<DateBucket, string> = {
  overdue: "⏰ Overdue", today: "📅 Today", tomorrow: "➡️ Tomorrow", yesterday: "⬅️ Yesterday",
  thisweek: "🗓️ This week", later: "📆 Later", nodate: "🕓 No due date", completed: "✅ Completed",
};
const BUCKET_ORDER: DateBucket[] = ["overdue","today","tomorrow","yesterday","thisweek","later","nodate","completed"];

function bucketFor(t: any): DateBucket {
  if (t.status === "done") return "completed";
  if (!t.due_date) return "nodate";
  const today = startOfDay(new Date());
  const d = startOfDay(new Date(t.due_date));
  if (d < today) {
    if (isSameDay(d, addDays(today, -1))) return "yesterday";
    return "overdue";
  }
  if (isSameDay(d, today)) return "today";
  if (isSameDay(d, addDays(today, 1))) return "tomorrow";
  const wkEnd = endOfWeek(today, { weekStartsOn: 1 });
  if (d <= wkEnd) return "thisweek";
  return "later";
}

const DATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisweek", label: "This week" },
  { key: "overdue", label: "Overdue" },
  { key: "nodate", label: "No date" },
] as const;

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const { pathname } = useLocation();
  const view = pathname.endsWith("/board") ? "board" : pathname.endsWith("/dashboard") ? "dashboard" : "list";

  const load = async () => {
    if (!user) return;
    const [t, st, tx, g, asg, mb] = await Promise.all([
      supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("subtasks").select("*").order("created_at", { ascending: true }),
      supabase.from("transactions").select("id, amount, fee, task_id, description, date").eq("user_id", user.id).not("task_id", "is", null),
      supabase.from("groups").select("id,name,emoji,kind"),
      supabase.from("task_assignees").select("*"),
      supabase.from("group_members").select("group_id,user_id,display_name"),
    ]);
    setTasks(t.data || []); setSubtasks(st.data || []); setTransactions(tx.data || []);
    setGroups(g.data || []); setAssignees(asg.data || []); setMembers(mb.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const subsByTask = useMemo(() => {
    const map: Record<string, any[]> = {};
    subtasks.forEach(s => { (map[s.task_id] ||= []).push(s); });
    return map;
  }, [subtasks]);

  const assigneesByTask = useMemo(() => {
    const map: Record<string, any[]> = {};
    assignees.forEach(a => { (map[a.task_id] ||= []).push(a); });
    return map;
  }, [assignees]);

  const taskCost = (id: string) => transactions.filter(tx => tx.task_id === id).reduce((a, tx) => a + Number(tx.amount) + Number(tx.fee || 0), 0);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (groupFilter === "personal" && t.group_id) return false;
      if (groupFilter !== "all" && groupFilter !== "personal" && t.group_id !== groupFilter) return false;
      if (dateFilter === "all") return true;
      if (dateFilter === "custom") {
        if (!customDate || !t.due_date) return false;
        return isSameDay(new Date(t.due_date), new Date(customDate));
      }
      return bucketFor(t) === dateFilter;
    });
  }, [tasks, dateFilter, customDate, groupFilter]);

  const grouped = useMemo(() => {
    const g: Record<DateBucket, any[]> = { overdue:[], today:[], tomorrow:[], yesterday:[], thisweek:[], later:[], nodate:[], completed:[] };
    filtered.forEach(t => g[bucketFor(t)].push(t));
    return g;
  }, [filtered]);

  const toggle = async (t: any) => {
    const newStatus = t.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null }).eq("id", t.id);
    load();
  };
  const remove = async (id: string) => { await supabase.from("tasks").delete().eq("id", id); toast.success("Task deleted"); load(); };

  const toggleSub = async (s: any) => {
    await supabase.from("subtasks").update({ done: !s.done }).eq("id", s.id);
    load();
  };

  const groupName = (gid?: string | null) => groups.find(g => g.id === gid);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">{tasks.filter(t => t.status !== "done").length} open · {tasks.filter(t => t.status === "done").length} done</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border bg-card p-1">
            <Link to="/tasks" className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 ${view==="list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><ListTodo className="h-3.5 w-3.5"/> List</Link>
            <Link to="/tasks/board" className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 ${view==="board" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><KanbanSquare className="h-3.5 w-3.5"/> Board</Link>
            <Link to="/tasks/dashboard" className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 ${view==="dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><BarChart3 className="h-3.5 w-3.5"/> Dashboard</Link>
          </div>
          <TaskSheet onSaved={load} groups={groups} members={members} />
        </div>
      </div>

      {view !== "dashboard" && (
        <Card className="bg-muted/30">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Date:</span>
            {DATE_FILTERS.map(f => (
              <Button key={f.key} size="sm" variant={dateFilter === f.key ? "default" : "outline"} onClick={() => { setDateFilter(f.key); setCustomDate(""); }}>{f.label}</Button>
            ))}
            <Input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setDateFilter("custom"); }} className="h-8 w-auto text-xs" />
            <div className="mx-2 h-5 w-px bg-border" />
            <span className="text-xs text-muted-foreground mr-1">Scope:</span>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scopes</SelectItem>
                <SelectItem value="personal">👤 Personal only</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(dateFilter !== "all" || groupFilter !== "all" || customDate) && (
              <Button size="sm" variant="ghost" onClick={() => { setDateFilter("all"); setGroupFilter("all"); setCustomDate(""); }}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {view === "dashboard" ? <TaskDashboard tasks={tasks} taskCost={taskCost} /> :
       view === "board" ? <Board tasks={filtered} subsByTask={subsByTask} assigneesByTask={assigneesByTask} members={members} groups={groups} taskCost={taskCost} onChange={load} /> : (
        <div className="space-y-6">
          {loading ? <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-20" />)}</div>
          : filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-muted-foreground">No tasks here — try a different filter or create one</p>
            </CardContent></Card>
          ) : BUCKET_ORDER.map(bk => grouped[bk].length === 0 ? null : (
            <div key={bk}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">{BUCKET_LABEL[bk]} ({grouped[bk].length})</h2>
              <div className="space-y-2">
                {grouped[bk].map(t => {
                  const s = TASK_STATUS_STYLES[t.status];
                  const cost = taskCost(t.id);
                  const subs = subsByTask[t.id] || [];
                  const done = subs.filter((x:any) => x.done).length;
                  const asgs = assigneesByTask[t.id] || [];
                  const grp = groupName(t.group_id);
                  return (
                    <Card key={t.id} className={`border-l-4 ${t.status === "done" ? "border-l-success opacity-70" : t.status === "in_progress" ? "border-l-primary" : "border-l-warning"}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle(t)} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                              <span>{t.due_date ? fmtDate(t.due_date) : "No due date"}</span>
                              {grp && <span>· {grp.emoji} {grp.name}</span>}
                              {asgs.length > 0 && <span>· 👥 {asgs.length}</span>}
                              {Number(t.planned_cost) > 0 && <span>· Budget {fmtKES(t.planned_cost)}</span>}
                              {cost > 0 && <span className="text-danger">· Spent {fmtKES(cost)}</span>}
                            </div>
                          </div>
                          <Badge variant="outline" className={s.bg + " " + s.text + " " + s.border}>{s.label}</Badge>
                          <Badge variant="outline" className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                          {t.due_date && <CalendarButtons task={t} />}
                          <TaskSheet task={t} onSaved={load} groups={groups} members={members} trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>} />
                          <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {subs.length > 0 && (
                          <div className="mt-2 ml-7 space-y-1">
                            <div className="flex items-center gap-2">
                              <Progress value={(done / subs.length) * 100} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground">{done}/{subs.length}</span>
                            </div>
                            <div className="space-y-1">
                              {subs.map((s: any) => (
                                <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <Checkbox checked={s.done} onCheckedChange={() => toggleSub(s)} />
                                  <span className={s.done ? "line-through text-muted-foreground" : ""}>{s.title}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Board({ tasks, subsByTask, assigneesByTask, members, groups, taskCost, onChange }: any) {
  const cols = [
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const id = e.active.id as string;
    const newStatus = e.over?.id as string | undefined;
    if (!newStatus) return;
    const t = tasks.find((x: any) => x.id === id);
    if (!t || t.status === newStatus) return;
    await supabase.from("tasks").update({ status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null }).eq("id", id);
    onChange();
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map(c => {
          const list = tasks.filter((t: any) => t.status === c.key);
          // Group by date bucket inside column
          const byBucket: Record<DateBucket, any[]> = { overdue:[], today:[], tomorrow:[], yesterday:[], thisweek:[], later:[], nodate:[], completed:[] };
          list.forEach((t: any) => byBucket[bucketFor(t)].push(t));
          const s = TASK_STATUS_STYLES[c.key];
          return (
            <Column key={c.key} colKey={c.key} label={s.label} accent={s} byBucket={byBucket}
              subsByTask={subsByTask} assigneesByTask={assigneesByTask} groups={groups} taskCost={taskCost} onChange={onChange} count={list.length} />
          );
        })}
      </div>
    </DndContext>
  );
}

function Column({ colKey, label, accent, byBucket, subsByTask, assigneesByTask, groups, taskCost, onChange, count }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div ref={setNodeRef} className={`rounded-2xl border-2 p-3 transition-colors ${accent.bg} ${isOver ? "ring-2 ring-primary" : accent.border}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-sm flex items-center gap-2 ${accent.text}`}>
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
          {label} <span className="ml-1 opacity-70">({count})</span>
        </h3>
      </div>
      <div className="space-y-3 min-h-32">
        {BUCKET_ORDER.map(bk => byBucket[bk].length === 0 ? null : (
          <div key={bk}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-1">{BUCKET_LABEL[bk]}</div>
            <div className="space-y-2">
              {byBucket[bk].map((t: any) => (
                <DraggableCard key={t.id} t={t} accent={accent} cost={taskCost(t.id)}
                  subs={subsByTask[t.id] || []} assignees={assigneesByTask[t.id] || []} groups={groups} onChange={onChange} />
              ))}
            </div>
          </div>
        ))}
        {count === 0 && <div className="text-xs text-muted-foreground text-center py-6">Drop here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ t, accent, cost, subs, assignees, groups, onChange }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const [open, setOpen] = useState(false);
  const doneCount = subs.filter((s: any) => s.done).length;
  const grp = groups.find((g: any) => g.id === t.group_id);

  const toggleSub = async (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("subtasks").update({ done: !s.done }).eq("id", s.id);
    onChange();
  };
  const markDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
    onChange();
  };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "opacity-50" : ""}`}>
      <Card className="bg-card hover:shadow-md transition-shadow">
        <CardContent className="p-3 space-y-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="flex items-center gap-2 text-xs flex-wrap mt-1">
                  <Badge variant="outline" className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                  {t.due_date && <span className="text-muted-foreground">{fmtDate(t.due_date)}</span>}
                  {grp && <span className="text-muted-foreground">· {grp.emoji}</span>}
                  {assignees.length > 0 && <span className="text-muted-foreground"><Users className="h-3 w-3 inline" /> {assignees.length}</span>}
                </div>
              </div>
            </div>
          </div>

          {subs.length > 0 && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <div className="flex items-center gap-2">
                <Progress value={(doneCount / subs.length) * 100} className="h-1.5 flex-1" />
                <CollapsibleTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {doneCount}/{subs.length} <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-2 space-y-1">
                {subs.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={s.done} onCheckedChange={() => {}} onClick={(e) => toggleSub(s, e as any)} />
                    <span className={s.done ? "line-through text-muted-foreground" : ""}>{s.title}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {(Number(t.planned_cost) > 0 || cost > 0) && (
            <div className="text-xs flex justify-between border-t pt-1.5">
              <span className="text-muted-foreground">Budget {fmtKES(t.planned_cost || 0)}</span>
              <span className={cost > Number(t.planned_cost || 0) ? "text-danger" : "text-success"}>Spent {fmtKES(cost)}</span>
            </div>
          )}

          {t.status !== "done" && (
            <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={markDone}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark done
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskDashboard({ tasks, taskCost }: any) {
  const byStatus = ["todo", "in_progress", "done"].map(k => ({
    name: TASK_STATUS_STYLES[k].label,
    value: tasks.filter((t: any) => t.status === k).length,
    color: k === "todo" ? "hsl(var(--warning))" : k === "in_progress" ? "hsl(var(--primary))" : "hsl(var(--success))",
  }));
  const byPriority = ["high","medium","low"].map(k => ({ name: k, value: tasks.filter((t:any) => t.priority === k).length }));
  const costData = tasks.filter((t:any) => Number(t.planned_cost) > 0 || taskCost(t.id) > 0)
    .map((t:any) => ({ name: t.title.slice(0,15), Budget: Number(t.planned_cost || 0), Spent: taskCost(t.id) }));
  const total = tasks.length;
  const done = tasks.filter((t:any) => t.status === "done").length;
  const overdue = tasks.filter((t:any) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length;
  const totalSpent = tasks.reduce((a:number,t:any) => a + taskCost(t.id), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatTile label="Total tasks" value={String(total)} />
        <StatTile label="Completed" value={`${done}/${total}`} tone="success" />
        <StatTile label="Overdue" value={String(overdue)} tone="danger" />
        <StatTile label="Spent on tasks" value={fmtKES(totalSpent)} tone="warning" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">By status</CardTitle></CardHeader><CardContent className="h-72">
          <ResponsiveContainer><PieChart>
            <Pie data={byStatus} dataKey="value" innerRadius={50} outerRadius={90}>
              {byStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">By priority</CardTitle></CardHeader><CardContent className="h-72">
          <ResponsiveContainer><BarChart data={byPriority}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" /><YAxis /><Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
          </BarChart></ResponsiveContainer>
        </CardContent></Card>
      </div>
      {costData.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">Budget vs Spent per task</CardTitle></CardHeader><CardContent className="h-80">
          <ResponsiveContainer><BarChart data={costData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v:any) => fmtKES(v as number)} /><Legend />
            <Bar dataKey="Budget" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
            <Bar dataKey="Spent" fill="hsl(var(--danger))" radius={[6,6,0,0]} />
          </BarChart></ResponsiveContainer>
        </CardContent></Card>
      )}
    </div>
  );
}

function StatTile({ label, value, tone }: any) {
  const t = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground";
  return <div className="ft-stat"><div className="text-sm text-muted-foreground">{label}</div><div className={`text-2xl font-bold mt-2 ${t}`}>{value}</div></div>;
}

function CalendarButtons({ task }: { task: any }) {
  const ev = {
    id: task.id, title: task.title, description: task.description || "",
    start: new Date(task.due_date), end: new Date(new Date(task.due_date).getTime() + 60*60*1000),
  };
  return (
    <>
      <Button asChild size="icon" variant="ghost" title="Add to Google Calendar">
        <a href={googleCalUrl(ev)} target="_blank" rel="noreferrer"><CalendarPlus className="h-4 w-4" /></a>
      </Button>
      <Button size="icon" variant="ghost" title="Download .ics" onClick={() => downloadICS(`${task.title}.ics`, buildICS([ev]))}>
        <Download className="h-4 w-4" />
      </Button>
    </>
  );
}

function TaskSheet({ task, onSaved, groups, members, trigger }: { task?: any; onSaved: () => void; groups: any[]; members: any[]; trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState("");
  const [plannedCost, setPlannedCost] = useState("");
  const [groupId, setGroupId] = useState<string>("personal");
  const [subs, setSubs] = useState<{ id?: string; title: string; done: boolean }[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title || ""); setDescription(task.description || ""); setPriority(task.priority);
      setStatus(task.status); setDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0,10) : "");
      setPlannedCost(task.planned_cost?.toString() || "");
      setGroupId(task.group_id || "personal");
      (async () => {
        const [{ data: sb }, { data: asg }] = await Promise.all([
          supabase.from("subtasks").select("*").eq("task_id", task.id).order("created_at"),
          supabase.from("task_assignees").select("user_id").eq("task_id", task.id),
        ]);
        setSubs((sb || []).map((s:any) => ({ id: s.id, title: s.title, done: s.done })));
        setSelectedAssignees((asg || []).map((a:any) => a.user_id));
      })();
    } else {
      setTitle(""); setDescription(""); setPriority("medium"); setStatus("todo");
      setDueDate(""); setPlannedCost(""); setGroupId("personal"); setSubs([]); setSelectedAssignees([]);
    }
  }, [open, task]);

  const groupMembers = useMemo(() =>
    groupId === "personal" ? [] : members.filter((m: any) => m.group_id === groupId),
    [members, groupId]
  );

  const submit = async () => {
    if (!title) { toast.error("Title required"); return; }
    const payload: any = {
      title, description: description || null, priority, status,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      planned_cost: plannedCost ? Number(plannedCost) : null,
      group_id: groupId === "personal" ? null : groupId,
    };
    let taskId = task?.id;
    if (task) {
      const res = await supabase.from("tasks").update(payload).eq("id", task.id);
      if (res.error) { toast.error(res.error.message); return; }
    } else {
      const res = await supabase.from("tasks").insert({ ...payload, user_id: user!.id }).select().single();
      if (res.error) { toast.error(res.error.message); return; }
      taskId = res.data.id;
    }

    // Sync subtasks
    const existingIds = subs.filter(s => s.id).map(s => s.id!);
    if (task) {
      // delete removed ones
      const { data: cur } = await supabase.from("subtasks").select("id").eq("task_id", taskId);
      const toDelete = (cur || []).map((c:any) => c.id).filter((id:string) => !existingIds.includes(id));
      if (toDelete.length) await supabase.from("subtasks").delete().in("id", toDelete);
    }
    for (const s of subs) {
      if (!s.title.trim()) continue;
      if (s.id) {
        await supabase.from("subtasks").update({ title: s.title, done: s.done }).eq("id", s.id);
      } else {
        await supabase.from("subtasks").insert({ task_id: taskId, title: s.title, done: s.done, user_id: user!.id });
      }
    }

    // Sync assignees (only if group)
    if (task) await supabase.from("task_assignees").delete().eq("task_id", taskId);
    if (groupId !== "personal" && selectedAssignees.length) {
      const rows = selectedAssignees.map(uid => ({ task_id: taskId, user_id: uid, assigned_by: user!.id }));
      await supabase.from("task_assignees").insert(rows);
    }

    toast.success(task ? "Task updated" : "Task created");
    setOpen(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger || <Button><Plus className="h-4 w-4 mr-1" /> Add task</Button>}</SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{task ? "Edit task" : "New task"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Working on Sample App" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

          <div>
            <Label>Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">👤 Personal</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {groupId !== "personal" && groupMembers.length > 0 && (
            <div>
              <Label>Assign to</Label>
              <div className="space-y-1 mt-1 max-h-32 overflow-y-auto border rounded-lg p-2">
                {groupMembers.map((m: any) => {
                  const checked = selectedAssignees.includes(m.user_id);
                  return (
                    <label key={m.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={(v) => {
                        setSelectedAssignees(v ? [...selectedAssignees, m.user_id] : selectedAssignees.filter(x => x !== m.user_id));
                      }} />
                      <span>{m.user_id === user?.id ? "Me" : (m.display_name || m.user_id.slice(0,8))}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><Label>Planned cost (KES)</Label><Input type="number" value={plannedCost} onChange={(e) => setPlannedCost(e.target.value)} placeholder="Optional" /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Subtasks</Label>
              <Button size="sm" variant="outline" type="button" onClick={() => setSubs([...subs, { title: "", done: false }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add subtask
              </Button>
            </div>
            <div className="space-y-1">
              {subs.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={s.done} onCheckedChange={(v) => {
                    const next = [...subs]; next[i] = { ...s, done: !!v }; setSubs(next);
                  }} />
                  <Input value={s.title} onChange={(e) => {
                    const next = [...subs]; next[i] = { ...s, title: e.target.value }; setSubs(next);
                  }} placeholder={`Subtask ${i+1} (e.g. Auth Screen)`} className="h-8" />
                  <Button size="icon" variant="ghost" type="button" onClick={() => setSubs(subs.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {subs.length === 0 && <p className="text-xs text-muted-foreground">Break this task into smaller steps. Parent auto-completes when all subtasks are checked.</p>}
            </div>
          </div>

          <Button className="w-full" onClick={submit}>{task ? "Save changes" : "Save task"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
