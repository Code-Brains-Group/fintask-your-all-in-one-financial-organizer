import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, Users, Crown, ListTodo, GraduationCap, Copy, Link2, PiggyBank,
  CheckCircle2, Circle, Clock, AlertTriangle, Activity, Calendar, Trophy, Flame, Sparkles, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { fmtKES } from "@/lib/finance";
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay, subDays } from "date-fns";

const APP_STATUS_COLORS: Record<string, string> = {
  saved: "bg-muted text-muted-foreground", applied: "bg-primary-soft text-primary",
  interview: "bg-warning-soft text-warning", offer: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger", accepted: "bg-success-soft text-success",
};
const STATUS_ICON: Record<string, any> = { done: CheckCircle2, in_progress: Clock, todo: Circle };
const MEDALS = ["🥇", "🥈", "🥉"];

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
  const [goals, setGoals] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDrawer, setMemberDrawer] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: g }, { data: m }, { data: inv }, { data: t }, { data: a }, { data: gl }, { data: cb }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("*").eq("group_id", id),
      supabase.from("group_invites").select("*").eq("group_id", id).eq("active", true),
      supabase.from("tasks").select("*").eq("group_id", id).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("applications").select("*").eq("group_id", id).order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("savings_goals").select("*").eq("group_id", id),
      supabase.from("savings_contributions").select("*").eq("group_id", id),
    ]);
    setGroup(g); setMembers(m || []); setInvites(inv || []); setTasks(t || []);
    setApps(a || []); setGoals(gl || []); setContribs(cb || []);
    if (t?.length) {
      const { data: s } = await supabase.from("subtasks").select("*").in("task_id", t.map((x: any) => x.id));
      setSubtasks(s || []);
    } else setSubtasks([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const isOwner = group?.created_by === user?.id;
  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const canAdmin = isOwner || myRole === "owner" || myRole === "admin";

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const done = tasks.filter(t => t.status === "done").length;
    const overdue = tasks.filter(t => t.status !== "done" && t.due_date && isBefore(new Date(t.due_date), today)).length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const activeApps = apps.filter(a => !["rejected", "accepted"].includes(a.status)).length;
    return { done, overdue, inProgress, activeApps, total: tasks.length };
  }, [tasks, apps]);

  // Leaderboard: aggregate contributions per member across all group goals
  const leaderboard = useMemo(() => {
    const totals: Record<string, { saved: number; count: number; last: string | null }> = {};
    contribs.forEach(c => {
      const k = c.user_id;
      totals[k] = totals[k] || { saved: 0, count: 0, last: null };
      totals[k].saved += Number(c.amount);
      totals[k].count += 1;
      if (!totals[k].last || c.date > totals[k].last!) totals[k].last = c.date;
    });
    // include members with 0
    members.forEach(m => { if (!totals[m.user_id]) totals[m.user_id] = { saved: 0, count: 0, last: null }; });
    const targetSum = goals.reduce((a, g) => a + Number(g.target_amount), 0);
    const rows = Object.entries(totals).map(([uid, v]) => {
      // Streak: consecutive days with a contribution up to today
      const userDays = new Set(contribs.filter(c => c.user_id === uid).map(c => c.date));
      let streak = 0; let cursor = startOfDay(new Date());
      while (userDays.has(format(cursor, "yyyy-MM-dd"))) { streak++; cursor = subDays(cursor, 1); }
      return { user_id: uid, ...v, streak };
    }).sort((a, b) => b.saved - a.saved);
    return { rows, targetSum, totalSaved: rows.reduce((a, r) => a + r.saved, 0) };
  }, [contribs, members, goals]);

  const activity = useMemo(() => {
    const items: any[] = [];
    tasks.forEach(t => {
      items.push({ at: t.created_at, label: `Task: ${t.title}` });
      if (t.completed_at) items.push({ at: t.completed_at, label: `✅ Done: ${t.title}` });
    });
    apps.forEach(a => items.push({ at: a.created_at, label: `🎓 ${a.title}${a.organization ? ` @ ${a.organization}` : ""}` }));
    contribs.forEach(c => {
      const g = goals.find(x => x.id === c.goal_id);
      items.push({ at: c.created_at, label: `💰 +${fmtKES(c.amount)} to ${g?.name || "goal"} by ${memberName(c.user_id)}` });
    });
    members.forEach(m => items.push({ at: m.created_at, label: `👋 ${m.user_id === user?.id ? "You" : (m.display_name || "Member")} joined` }));
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 15);
  }, [tasks, apps, members, contribs, goals, user]);

  function memberName(uid: string) {
    if (uid === user?.id) return "You";
    const m = members.find(x => x.user_id === uid);
    return m?.display_name || "Member";
  }

  const copyInvite = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    toast.success("Invite link copied!");
  };
  const setRole = async (mid: string, role: string) => {
    const { error } = await supabase.from("group_members").update({ role }).eq("id", mid);
    if (error) { toast.error(error.message); return; }
    toast.success(`Role updated to ${role}`); load();
  };
  const removeMember = async (mid: string) => {
    if (!confirm("Remove this member from the group?")) return;
    const { error } = await supabase.from("group_members").delete().eq("id", mid);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed"); load();
  };

  if (loading) return <div className="skeleton h-96" />;
  if (!group) return <Card><CardContent className="py-16 text-center">Group not found. <Button variant="link" onClick={() => nav("/groups")}>Back</Button></CardContent></Card>;

  const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const savingsPct = leaderboard.targetSum ? Math.min(100, Math.round((leaderboard.totalSaved / leaderboard.targetSum) * 100)) : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => nav("/groups")} className="-ml-2"><ArrowLeft className="h-4 w-4 mr-1" /> All groups</Button>

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
                {myRole && <Badge variant="outline" className="capitalize">{myRole === "owner" ? "👑 owner" : myRole === "admin" ? "🛡️ admin" : "member"}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={ListTodo} label="Tasks" value={stats.total} hint={`${stats.done} done`} tone="primary" />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} hint="attention" tone="danger" />
        <StatCard icon={Clock} label="In progress" value={stats.inProgress} hint="active" tone="warning" />
        <StatCard icon={GraduationCap} label="Applications" value={apps.length} hint={`${stats.activeApps} active`} tone="success" />
        <StatCard icon={PiggyBank} label="Saved" value={fmtKES(leaderboard.totalSaved)} hint={`${goals.length} goal${goals.length===1?"":"s"}`} tone="primary" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><Activity className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="tasks"><ListTodo className="h-4 w-4 mr-1" /> Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="applications"><GraduationCap className="h-4 w-4 mr-1" /> Applications ({apps.length})</TabsTrigger>
          <TabsTrigger value="savings"><Trophy className="h-4 w-4 mr-1" /> Savings & Leaderboard</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" /> Members</TabsTrigger>
        </TabsList>

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

          {stats.total > 0 && (
            <Card><CardContent className="py-4">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium">Group task progress</span>
                <span className="text-muted-foreground">{stats.done}/{stats.total} ({progress}%)</span>
              </div>
              <Progress value={progress} />
            </CardContent></Card>
          )}

          {canAdmin && (
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
                          <button className="text-xs underline-offset-2 hover:underline text-muted-foreground" onClick={() => setMemberDrawer(t.user_id)}>by {memberName(t.user_id)}</button>
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
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="outline" className="text-xs capitalize">{a.kind}</Badge>
                      {a.deadline && <Badge variant="outline" className="text-xs"><Calendar className="h-3 w-3 mr-1" />Due {format(new Date(a.deadline), "MMM d")}</Badge>}
                      <button className="text-xs underline-offset-2 hover:underline text-muted-foreground" onClick={() => setMemberDrawer(a.user_id)}>by {memberName(a.user_id)}</button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Savings & Leaderboard */}
        <TabsContent value="savings" className="mt-4 space-y-4">
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-warning via-primary to-success" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Savings Showdown</CardTitle>
              <p className="text-xs text-muted-foreground">Total {fmtKES(leaderboard.totalSaved)} {leaderboard.targetSum > 0 && `of ${fmtKES(leaderboard.targetSum)} target (${savingsPct}%)`}</p>
            </CardHeader>
            <CardContent>
              {leaderboard.targetSum > 0 && <Progress value={savingsPct} className="mb-4" />}
              {goals.length === 0 ? (
                <div className="py-8 text-center">
                  <PiggyBank className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-3">No group savings goals yet. Create one and challenge members!</p>
                  <Button asChild><Link to="/finance/savings">Create group goal</Link></Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.rows.map((r, i) => {
                    const top = leaderboard.rows[0]?.saved || 1;
                    const pct = top > 0 ? (r.saved / top) * 100 : 0;
                    const isMe = r.user_id === user?.id;
                    return (
                      <button
                        key={r.user_id} onClick={() => setMemberDrawer(r.user_id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${isMe ? "border-primary/50 bg-primary-soft/30" : "border-border hover:border-primary/30 hover:bg-muted/40"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl w-8 text-center">{MEDALS[i] || `#${i+1}`}</div>
                          <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">
                            {memberName(r.user_id)[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="font-medium truncate">{memberName(r.user_id)} {isMe && <span className="text-xs text-primary">(you)</span>}</div>
                              <div className="font-bold tabular-nums">{fmtKES(r.saved)}</div>
                            </div>
                            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span>{r.count} deposit{r.count===1?"":"s"}</span>
                              {r.streak > 0 && <span className="flex items-center gap-0.5 text-warning"><Flame className="h-3 w-3" />{r.streak} day streak</span>}
                              {r.last && <span>· last {formatDistanceToNow(new Date(r.last), { addSuffix: true })}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {goals.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {goals.map(g => {
                const saved = contribs.filter(c => c.goal_id === g.id).reduce((a, c) => a + Number(c.amount), 0);
                const pct = Math.min(100, (saved / Number(g.target_amount)) * 100);
                return (
                  <Card key={g.id}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{g.icon} {g.name}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{fmtKES(saved)}</span><span className="text-muted-foreground">/ {fmtKES(g.target_amount)}</span></div>
                      <Progress value={pct} />
                      <div className="text-xs text-muted-foreground mt-2">Started by {memberName(g.user_id)}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map(m => {
              const isMe = m.user_id === user?.id;
              const tCount = tasks.filter(t => t.user_id === m.user_id).length;
              const aCount = apps.filter(a => a.user_id === m.user_id).length;
              const saved = contribs.filter(c => c.user_id === m.user_id).reduce((s, c) => s + Number(c.amount), 0);
              return (
                <Card key={m.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <button className="flex items-center gap-3 w-full text-left" onClick={() => setMemberDrawer(m.user_id)}>
                      <div className="h-12 w-12 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-bold">
                        {(m.display_name || (isMe ? "Y" : "?"))[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-1 truncate">
                          {isMe ? "You" : (m.display_name || "Member")}
                          {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-warning" />}
                          {m.role === "admin" && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{tCount} task · {aCount} app · {fmtKES(saved)}</div>
                      </div>
                    </button>
                    {canAdmin && !isMe && m.role !== "owner" && (
                      <div className="flex gap-1 mt-3 border-t pt-2">
                        {m.role === "admin" ? (
                          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setRole(m.id, "member")}>Demote</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setRole(m.id, "admin")}><ShieldCheck className="h-3 w-3 mr-1" />Make admin</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-danger text-xs" onClick={() => removeMember(m.id)}>Remove</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <MemberDrawer
        open={!!memberDrawer} onClose={() => setMemberDrawer(null)}
        userId={memberDrawer} members={members} tasks={tasks} apps={apps}
        goals={goals} contribs={contribs} subtasks={subtasks} me={user?.id}
      />
    </div>
  );
}

function MemberDrawer({ open, onClose, userId, members, tasks, apps, goals, contribs, subtasks, me }: any) {
  if (!userId) return null;
  const m = members.find((x: any) => x.user_id === userId);
  const name = userId === me ? "You" : (m?.display_name || "Member");
  const userTasks = tasks.filter((t: any) => t.user_id === userId);
  const userApps = apps.filter((a: any) => a.user_id === userId);
  const userContribs = contribs.filter((c: any) => c.user_id === userId);
  const saved = userContribs.reduce((s: number, c: any) => s + Number(c.amount), 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center font-bold text-lg">{name[0]?.toUpperCase()}</div>
            <div>
              <div className="text-lg">{name}</div>
              <div className="text-xs font-normal text-muted-foreground capitalize">{m?.role || "member"}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 mt-6">
          <MiniStat label="Tasks" value={userTasks.length} />
          <MiniStat label="Apps" value={userApps.length} />
          <MiniStat label="Saved" value={fmtKES(saved)} />
        </div>

        <Section title="Tasks" icon={ListTodo}>
          {userTasks.length === 0 ? <Empty msg="No tasks" /> :
            userTasks.map((t: any) => {
              const subs = subtasks.filter((s: any) => s.task_id === t.id);
              return (
                <div key={t.id} className="p-2.5 rounded-lg border flex items-start gap-2">
                  {t.status === "done" ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5" /> : <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.status === "done" ? "line-through opacity-60" : ""}`}>{t.title}</div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      {t.due_date && <span><Calendar className="h-3 w-3 inline mr-0.5" />{format(new Date(t.due_date), "MMM d")}</span>}
                      {subs.length > 0 && <span>{subs.filter((s: any) => s.done).length}/{subs.length} subtasks</span>}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </Section>

        <Section title="Applications" icon={GraduationCap}>
          {userApps.length === 0 ? <Empty msg="No applications" /> :
            userApps.map((a: any) => (
              <div key={a.id} className="p-2.5 rounded-lg border">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <Badge variant="outline" className="text-xs capitalize">{a.status}</Badge>
                </div>
                {a.organization && <div className="text-xs text-muted-foreground truncate">{a.organization}</div>}
                {a.deadline && <div className="text-xs text-muted-foreground mt-0.5"><Calendar className="h-3 w-3 inline mr-0.5" />Due {format(new Date(a.deadline), "MMM d")}</div>}
              </div>
            ))
          }
        </Section>

        <Section title="Savings contributions" icon={PiggyBank}>
          {userContribs.length === 0 ? <Empty msg="No contributions yet" /> :
            <>
              <div className="mb-2 p-3 rounded-lg bg-gradient-to-br from-primary-soft to-success/10">
                <div className="text-xs text-muted-foreground">Total contributed to group</div>
                <div className="text-xl font-bold">{fmtKES(saved)}</div>
              </div>
              {userContribs.slice(0, 10).map((c: any) => {
                const g = goals.find((x: any) => x.id === c.goal_id);
                return (
                  <div key={c.id} className="p-2.5 rounded-lg border flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{g?.icon} {g?.name || "Goal"}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(c.date), "MMM d, yyyy")}</div>
                    </div>
                    <div className="font-semibold tabular-nums text-success">+{fmtKES(c.amount)}</div>
                  </div>
                );
              })}
            </>
          }
        </Section>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Icon className="h-4 w-4" /> {title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Empty({ msg }: any) { return <p className="text-xs text-muted-foreground py-3 text-center">{msg}</p>; }
function MiniStat({ label, value }: any) {
  return <div className="p-2.5 rounded-lg bg-muted/40 text-center"><div className="text-base font-bold tabular-nums truncate">{value}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div></div>;
}

function StatCard({ icon: Icon, label, value, hint, tone }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary-soft", danger: "text-danger bg-danger-soft",
    warning: "text-warning bg-warning-soft", success: "text-success bg-success-soft",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex h-9 w-9 rounded-lg items-center justify-center ${tones[tone]}`}><Icon className="h-4 w-4" /></div>
        <div className="mt-2 text-xl font-bold truncate">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label} · {hint}</div>
      </CardContent>
    </Card>
  );
}
