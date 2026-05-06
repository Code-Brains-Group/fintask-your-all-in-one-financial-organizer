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
import { Plus, Trash2, KanbanSquare, ListTodo, BarChart3, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "react-router-dom";
import {
  DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-danger-soft text-danger border-danger/30",
  medium: "bg-warning-soft text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { pathname } = useLocation();
  const view = pathname.endsWith("/board") ? "board" : pathname.endsWith("/dashboard") ? "dashboard" : "list";

  const load = async () => {
    if (!user) return;
    const [t, tx] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("transactions").select("id, amount, fee, task_id, description, date").eq("user_id", user.id).not("task_id", "is", null),
    ]);
    setTasks(t.data || []); setTransactions(tx.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const taskCost = (id: string) => transactions.filter(tx => tx.task_id === id).reduce((a, tx) => a + Number(tx.amount) + Number(tx.fee || 0), 0);

  const groups = {
    Overdue: tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < today),
    Today: tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) < tomorrow),
    Upcoming: tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) >= tomorrow),
    "No Due Date": tasks.filter(t => t.status !== "done" && !t.due_date),
    Completed: tasks.filter(t => t.status === "done"),
  };

  const toggle = async (t: any) => {
    const newStatus = t.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null }).eq("id", t.id);
    load();
  };
  const remove = async (id: string) => { await supabase.from("tasks").delete().eq("id", id); toast.success("Task deleted"); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">{tasks.filter(t => t.status !== "done").length} open</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border bg-card p-1">
            <Link to="/tasks" className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 ${view==="list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><ListTodo className="h-3.5 w-3.5"/> List</Link>
            <Link to="/tasks/board" className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 ${view==="board" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><KanbanSquare className="h-3.5 w-3.5"/> Board</Link>
            <Link to="/tasks/dashboard" className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1 ${view==="dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><BarChart3 className="h-3.5 w-3.5"/> Dashboard</Link>
          </div>
          <TaskSheet onSaved={load} />
        </div>
      </div>

      {view === "dashboard" ? <TaskDashboard tasks={tasks} taskCost={taskCost} /> :
       view === "board" ? <Board tasks={tasks} taskCost={taskCost} onChange={load} /> : (
        <div className="space-y-6">
          {loading ? <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-20" />)}</div>
          : tasks.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-muted-foreground">No tasks yet — let's create one</p>
            </CardContent></Card>
          ) : Object.entries(groups).map(([name, list]) => list.length === 0 ? null : (
            <div key={name}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">{name} ({list.length})</h2>
              <div className="space-y-2">
                {list.map(t => {
                  const s = TASK_STATUS_STYLES[t.status];
                  const cost = taskCost(t.id);
                  return (
                    <Card key={t.id} className={`border-l-4 ${t.status === "done" ? "border-l-success opacity-60" : t.status === "in_progress" ? "border-l-primary" : "border-l-warning"}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle(t)} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                            <span>{t.due_date ? fmtDate(t.due_date) : "No due date"}</span>
                            {Number(t.planned_cost) > 0 && <span>· Budget {fmtKES(t.planned_cost)}</span>}
                            {cost > 0 && <span className="text-danger">· Spent {fmtKES(cost)}</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className={s.bg + " " + s.text + " " + s.border}>{s.label}</Badge>
                        <Badge variant="outline" className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                        <TaskSheet task={t} onSaved={load} trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>} />
                        <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
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

function Board({ tasks, taskCost, onChange }: any) {
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
          const s = TASK_STATUS_STYLES[c.key];
          return <Column key={c.key} colKey={c.key} label={s.label} accent={s} list={list} taskCost={taskCost} onChange={onChange} />;
        })}
      </div>
    </DndContext>
  );
}

function Column({ colKey, label, accent, list, taskCost, onChange }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div ref={setNodeRef} className={`rounded-2xl border-2 p-3 transition-colors ${accent.bg} ${isOver ? "ring-2 ring-primary" : accent.border}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-sm flex items-center gap-2 ${accent.text}`}>
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
          {label} <span className="ml-1 opacity-70">({list.length})</span>
        </h3>
      </div>
      <div className="space-y-2 min-h-32">
        {list.map((t: any) => <DraggableCard key={t.id} t={t} accent={accent} cost={taskCost(t.id)} onChange={onChange} />)}
        {list.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Drop here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ t, accent, cost, onChange }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}>
      <Card className="bg-card hover:shadow-md transition-shadow">
        <CardContent className="p-3 space-y-2">
          <div className="text-sm font-medium">{t.title}</div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge variant="outline" className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
            {t.due_date && <span className="text-muted-foreground">{fmtDate(t.due_date)}</span>}
          </div>
          {(Number(t.planned_cost) > 0 || cost > 0) && (
            <div className="text-xs flex justify-between border-t pt-1.5">
              <span className="text-muted-foreground">Budget {fmtKES(t.planned_cost || 0)}</span>
              <span className={cost > Number(t.planned_cost || 0) ? "text-danger" : "text-success"}>Spent {fmtKES(cost)}</span>
            </div>
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

function TaskSheet({ task, onSaved, trigger }: { task?: any; onSaved: () => void; trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [status, setStatus] = useState(task?.status || "todo");
  const [dueDate, setDueDate] = useState(task?.due_date ? new Date(task.due_date).toISOString().slice(0,10) : "");
  const [plannedCost, setPlannedCost] = useState(task?.planned_cost?.toString() || "");

  useEffect(() => {
    if (open && task) {
      setTitle(task.title || ""); setDescription(task.description || ""); setPriority(task.priority);
      setStatus(task.status); setDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0,10) : "");
      setPlannedCost(task.planned_cost?.toString() || "");
    }
  }, [open, task]);

  const submit = async () => {
    if (!title) { toast.error("Title required"); return; }
    const payload: any = {
      title, description: description || null, priority, status,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      planned_cost: plannedCost ? Number(plannedCost) : null,
    };
    const res = task
      ? await supabase.from("tasks").update(payload).eq("id", task.id)
      : await supabase.from("tasks").insert({ ...payload, user_id: user!.id });
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(task ? "Task updated" : "Task created");
    setOpen(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger || <Button><Plus className="h-4 w-4 mr-1" /> Add task</Button>}</SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{task ? "Edit task" : "New task"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
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
          <Button className="w-full" onClick={submit}>{task ? "Save changes" : "Save task"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
