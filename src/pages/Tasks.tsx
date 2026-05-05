import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtDate } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, KanbanSquare, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "react-router-dom";

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { pathname } = useLocation();
  const isBoard = pathname.endsWith("/board");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={isBoard ? "/tasks" : "/tasks/board"}>
              {isBoard ? <ListTodo className="h-4 w-4 mr-1" /> : <KanbanSquare className="h-4 w-4 mr-1" />}
              {isBoard ? "List view" : "Board view"}
            </Link>
          </Button>
          <AddTask onSaved={load} />
        </div>
      </div>

      {isBoard ? <Board tasks={tasks} onChange={load} /> : (
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
                {list.map(t => (
                  <Card key={t.id} className={t.status === "done" ? "opacity-60" : ""}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle(t)} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.due_date ? fmtDate(t.due_date) : "No due date"}</div>
                      </div>
                      <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"} className="capitalize">{t.priority}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Board({ tasks, onChange }: any) {
  const cols = [
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];
  const move = async (id: string, status: string) => {
    await supabase.from("tasks").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", id);
    onChange();
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cols.map(c => {
        const list = tasks.filter((t: any) => t.status === c.key);
        return (
          <div key={c.key} className="rounded-2xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{c.label} <span className="ml-1 text-muted-foreground">({list.length})</span></h3>
            </div>
            <div className="space-y-2">
              {list.map((t: any) => (
                <Card key={t.id} className={c.key === "done" ? "opacity-70" : ""}>
                  <CardContent className="p-3 space-y-2">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={t.priority === "high" ? "destructive" : t.priority === "medium" ? "default" : "secondary"}>{t.priority}</Badge>
                      {t.due_date && <span className="text-muted-foreground">{fmtDate(t.due_date)}</span>}
                    </div>
                    <Select value={t.status} onValueChange={(v) => move(t.id, v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cols.map(cc => <SelectItem key={cc.key} value={cc.key}>{cc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
              {list.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No tasks</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddTask({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

  const submit = async () => {
    if (!title) { toast.error("Title required"); return; }
    const { error } = await supabase.from("tasks").insert({
      user_id: user!.id, title, description: description || null,
      priority, due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setTitle(""); setDescription(""); setPriority("medium"); setDueDate("");
    setOpen(false); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add task</Button></SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>New task</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div><Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <Button className="w-full" onClick={submit}>Save task</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
