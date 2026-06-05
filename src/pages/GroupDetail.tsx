import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Users, Crown, ListTodo, GraduationCap, Copy, Link2,
  CheckCircle2, Circle, Clock, AlertTriangle, Activity, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from "date-fns";

const APP_STATUS_COLORS: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  applied: "bg-primary-soft text-primary",
  interview: "bg-warning-soft text-warning",
  offer: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  accepted: "bg-success-soft text-success",
};

const STATUS_ICON: Record<string, any> = { done: CheckCircle2, in_progress: Clock, todo: Circle };

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: g }, { data: m }, { data: inv }, { data: t }, { data: a }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("*").eq("group_id", id),
      supabase.from("group_invites").select("*").eq("group_id", id).eq("active", true),
      supabase.from("tasks").select("*").eq("group_id", id).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("applications").select("*").eq("group_id", id).order("deadline", { ascending: true, nullsFirst: false }),
    ]);
    setGroup(g); setMembers(m || []); setInvites(inv || []); setTasks(t || []); setApps(a || []);
    if (t?.length) {
      const { data: s } = await supabase.from("subtasks").select("*").in("task_id", t.map((x: any) => x.id));
      setSubtasks(s || []);
    } else setSubtasks([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const done = tasks.filter(t => t.status === "done").length;
    const overdue = tasks.filter(t => t.status !== "done" && t.due_date && isBefore(new Date(t.due_date), today)).length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const upcomingApps = apps.filter(a => a.deadline && isAfter(new Date(a.deadline), today)).length;
    const activeApps = apps.filter(a => !["rejected", "accepted"].includes(a.status)).length;
    return { done, overdue, inProgress, upcomingApps, activeApps, total: tasks.length };
  }, [tasks, apps]);

  const activity = useMemo(() => {
    const items: any[] = [];
    tasks.forEach(t => {
      items.push({ kind: "task_created", at: t.created_at, label: `Task created: ${t.title}`, ref: t });
      if (t.completed_at) items.push({ kind: "task_done", at: t.completed_at, label: `Task completed: ${t.title}`, ref: t });
    });
    apps.forEach(a => {
      items.push({ kind: "app_created", at: a.created_at, label: `Application: ${a.title}${a.organization ? ` @ ${a.organization}` : ""}`, ref: a });
    });
    members.forEach(m => {
      items.push({ kind: "member", at: m.created_at, label: `${m.user_id === user?.id ? "You" : (m.display_name || "Member")} joined`, ref: m });
    });
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 15);
  }, [tasks, apps, members, user]);

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    toast.success("Invite link copied!");
  };

  const memberName = (uid: string) => {
    if (uid === user?.id) return "You";
    const m = members.find(x => x.user_id === uid);
    return m?.display_name || uid.slice(0, 6);
  };

  if (loading) return <div className="skeleton h-96" />;
  if (!group) return <Card><CardContent className="py-16 text-center">Group not found. <Button variant="link" onClick={() => nav("/groups")}>Back</Button></CardContent></Card>;

  const isOwner = group.created_by === user?.id;
  const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav("/groups")} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1" /> All groups</Button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20" />
        <CardContent className="-mt-12 pb-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="h-20 w-20 rounded-2xl bg-card border-4 border-card shadow-md grid place-items-center text-4xl">{group.emoji || "👥"}</div>
            <div className="flex-1 min-w-0 pt-3">
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                {group.name} {isOwner && <Crown className="h-5 w-5 text-warning" />}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{group.description || "No description"}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{members.length} member{members.length===1?"":"s"}</Badge>
                <Badge variant="outline">Created {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}</Badge>
                <Badge variant="outline" className="capitalize">{group.kind}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ListTodo} label="Tasks" value={stats.total} hint={`${stats.done} done`} tone="primary" />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} hint="needs attention" tone="danger" />
        <StatCard icon={Clock} label="In progress" value={stats.inProgress} hint="active work" tone="warning" />
        <StatCard icon={GraduationCap} label="Applications" value={apps.length} hint={`${stats.activeApps} active`} tone="success" />
      </div>

      {stats.total > 0 && (
        <Card><CardContent className="py-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">Group task progress</span>
            <span className="text-muted-foreground">{stats.done}/{stats.total} ({progress}%)</span>
          </div>
          <Progress value={progress} />
        </CardContent></Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="overview"><Activity className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="tasks"><ListTodo className="h-4 w-4 mr-1" /> Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="applications"><GraduationCap className="h-4 w-4 mr-1" /> Applications ({apps.length})</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" /> Members</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Recent activity</CardTitle></CardHeader>
              <CardContent>
                {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> :
                  <ul className="space-y-2.5">
                    {activity.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{a.label}</div>
                          <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                }
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Coming up</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[...tasks.filter(t => t.status !== "done" && t.due_date), ...apps.filter(a => a.deadline)]
                  .sort((a, b) => +new Date(a.due_date || a.deadline) - +new Date(b.due_date || b.deadline))
                  .slice(0, 6).map((x: any, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-2 min-w-0">
                        {x.deadline ? <GraduationCap className="h-4 w-4 text-success shrink-0" /> : <ListTodo className="h-4 w-4 text-primary shrink-0" />}
                        <span className="text-sm truncate">{x.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{format(new Date(x.due_date || x.deadline), "MMM d")}</span>
                    </div>
                  ))
                }
                {tasks.length === 0 && apps.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
              </CardContent>
            </Card>
          </div>

          {isOwner && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Invite links</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {invites.length === 0 ? <p className="text-sm text-muted-foreground">No active invite codes. Create one from the Groups page.</p> :
                  invites.map(i => (
                    <div key={i.id} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                      <code className="text-xs font-mono flex-1 truncate">{i.code}</code>
                      <span className="text-xs text-muted-foreground">{i.uses} use{i.uses===1?"":"s"}</span>
                      <Button size="icon" variant="ghost" onClick={() => copyInvite(i.code)}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))
                }
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-4">
          {tasks.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ListTodo className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground mb-3">No tasks in this group yet.</p>
              <Button asChild><Link to="/tasks">Go to Tasks</Link></Button>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => {
                const subs = subtasks.filter(s => s.task_id === t.id);
                const subDone = subs.filter(s => s.done).length;
                const Icon = STATUS_ICON[t.status] || Circle;
                const isOverdue = t.due_date && t.status !== "done" && isBefore(new Date(t.due_date), startOfDay(new Date()));
                return (
                  <Card key={t.id} className={`hover:shadow-md transition-shadow ${t.status === "done" ? "opacity-60" : ""}`}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${t.status === "done" ? "text-success" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
                        {t.description && <div className="text-sm text-muted-foreground line-clamp-1">{t.description}</div>}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-xs capitalize">{t.priority}</Badge>
                          {t.due_date && <Badge variant="outline" className={`text-xs ${isOverdue ? "text-danger border-danger/30" : ""}`}>
                            <Calendar className="h-3 w-3 mr-1" />{format(new Date(t.due_date), "MMM d")}
                          </Badge>}
                          <Badge variant="outline" className="text-xs">by {memberName(t.user_id)}</Badge>
                          {subs.length > 0 && <Badge variant="outline" className="text-xs">{subDone}/{subs.length} subtasks</Badge>}
                        </div>
                        {subs.length > 0 && <Progress value={(subDone / subs.length) * 100} className="h-1 mt-2" />}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Applications */}
        <TabsContent value="applications" className="mt-4">
          {apps.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground mb-3">No applications shared with this group yet.</p>
              <Button asChild><Link to="/applications">Go to Applications</Link></Button>
            </CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {apps.map(a => (
                <Card key={a.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{a.title}</div>
                        {a.organization && <div className="text-sm text-muted-foreground truncate">{a.organization}</div>}
                      </div>
                      <Badge className={`${APP_STATUS_COLORS[a.status] || "bg-muted"} capitalize text-xs`}>{a.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs capitalize">{a.kind}</Badge>
                      {a.deadline && <Badge variant="outline" className="text-xs"><Calendar className="h-3 w-3 mr-1" />Due {format(new Date(a.deadline), "MMM d")}</Badge>}
                      <Badge variant="outline" className="text-xs">by {memberName(a.user_id)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members */}
        <TabsContent value="members" className="mt-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map(m => {
              const isMe = m.user_id === user?.id;
              const taskCount = tasks.filter(t => t.user_id === m.user_id).length;
              const appCount = apps.filter(a => a.user_id === m.user_id).length;
              return (
                <Card key={m.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-bold">
                      {(m.display_name || (isMe ? "You" : "?"))[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-1 truncate">
                        {isMe ? "You" : (m.display_name || m.user_id.slice(0,8))}
                        {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-warning" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{taskCount} task{taskCount===1?"":"s"} · {appCount} app{appCount===1?"":"s"}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary-soft",
    danger: "text-danger bg-danger-soft",
    warning: "text-warning bg-warning-soft",
    success: "text-success bg-success-soft",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex h-9 w-9 rounded-lg items-center justify-center ${tones[tone]}`}><Icon className="h-4.5 w-4.5" /></div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label} · {hint}</div>
      </CardContent>
    </Card>
  );
}
