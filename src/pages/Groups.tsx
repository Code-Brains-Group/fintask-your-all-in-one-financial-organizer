import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Link2, Copy, Trash2, Crown, LogOut } from "lucide-react";
import { toast } from "sonner";

const KIND_LABEL: Record<string, string> = { general: "General", tasks: "Tasks", applications: "Applications" };

function randCode(len = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [invites, setInvites] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: g } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups(g || []);
    if (g?.length) {
      const ids = g.map((x: any) => x.id);
      const [{ data: m }, { data: inv }] = await Promise.all([
        supabase.from("group_members").select("*").in("group_id", ids),
        supabase.from("group_invites").select("*").in("group_id", ids),
      ]);
      const byG: Record<string, any[]> = {}, byI: Record<string, any[]> = {};
      (m || []).forEach((x: any) => { (byG[x.group_id] ||= []).push(x); });
      (inv || []).forEach((x: any) => { (byI[x.group_id] ||= []).push(x); });
      setMembers(byG); setInvites(byI);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const join = async () => {
    if (!joinCode.trim()) { toast.error("Enter an invite code"); return; }
    const { data, error } = await supabase.rpc("accept_group_invite", { _code: joinCode.trim().toUpperCase() });
    if (error) { toast.error(error.message); return; }
    toast.success("Joined group!"); setJoinCode(""); load();
  };

  const leave = async (gid: string) => {
    if (!confirm("Leave this group?")) return;
    await supabase.from("group_members").delete().eq("group_id", gid).eq("user_id", user!.id);
    toast.success("Left group"); load();
  };
  const removeGroup = async (gid: string) => {
    if (!confirm("Delete group? All shared tasks/applications will be unlinked.")) return;
    await supabase.from("groups").delete().eq("id", gid);
    toast.success("Group deleted"); load();
  };

  const createInvite = async (gid: string) => {
    const code = randCode();
    const { error } = await supabase.from("group_invites").insert({
      group_id: gid, code, created_by: user!.id, active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Invite created"); load();
  };
  const copyInvite = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  };
  const revokeInvite = async (id: string) => {
    await supabase.from("group_invites").update({ active: false }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Groups</h1>
          <p className="text-muted-foreground text-sm">Collaborate on tasks and applications with others</p>
        </div>
        <CreateGroupSheet onSaved={load} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Join a group</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Enter invite code (e.g. AB23CDEF)" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="flex-1 min-w-[200px]" />
          <Button onClick={join}><Link2 className="h-4 w-4 mr-1" /> Join</Button>
        </CardContent>
      </Card>

      {loading ? <div className="skeleton h-40" /> : groups.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-muted-foreground mb-4">No groups yet. Create one to collaborate.</p>
          <CreateGroupSheet onSaved={load} />
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(g => {
            const isOwner = g.created_by === user?.id;
            const ms = members[g.id] || [];
            const inv = (invites[g.id] || []).filter((i: any) => i.active);
            return (
              <Card key={g.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{g.emoji || "👥"}</div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">{g.name} {isOwner && <Crown className="h-3.5 w-3.5 text-warning" />}</CardTitle>
                      <div className="text-xs text-muted-foreground">{KIND_LABEL[g.kind] || g.kind} · {ms.length} member{ms.length===1?"":"s"}</div>
                    </div>
                  </div>
                  {g.description && <p className="text-sm text-muted-foreground mt-2">{g.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {ms.map((m: any) => (
                      <Badge key={m.id} variant="outline" className="text-xs">
                        {m.user_id === user?.id ? "You" : (m.display_name || m.user_id.slice(0,6))} {m.role === "owner" && "👑"}
                      </Badge>
                    ))}
                  </div>

                  {isOwner && (
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground">Invite links</div>
                        <Button size="sm" variant="outline" onClick={() => createInvite(g.id)}><Plus className="h-3 w-3 mr-1" /> New code</Button>
                      </div>
                      {inv.length === 0 ? <div className="text-xs text-muted-foreground">No active invite codes</div> :
                        inv.map((i: any) => (
                          <div key={i.id} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                            <code className="text-xs font-mono flex-1 truncate">{i.code}</code>
                            <span className="text-xs text-muted-foreground">{i.uses} use{i.uses===1?"":"s"}</span>
                            <Button size="icon" variant="ghost" onClick={() => copyInvite(i.code)} title="Copy link"><Copy className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => revokeInvite(i.id)} title="Revoke"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t pt-3">
                    {isOwner ? (
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => removeGroup(g.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => leave(g.id)}>
                        <LogOut className="h-4 w-4 mr-1" /> Leave
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateGroupSheet({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ kind: "general", emoji: "👥" });

  const submit = async () => {
    if (!f.name) { toast.error("Name required"); return; }
    const { data, error } = await supabase.from("groups").insert({
      name: f.name, kind: f.kind, emoji: f.emoji || "👥", description: f.description || null, created_by: user!.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    // Auto-create one invite link
    await supabase.from("group_invites").insert({ group_id: data.id, code: randCode(), created_by: user!.id, active: true });
    toast.success("Group created"); setOpen(false); setF({ kind: "general", emoji: "👥" }); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New group</Button></SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>Create a group</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div><Label>Icon</Label><Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} maxLength={2} className="text-center text-xl" /></div>
            <div><Label>Name</Label><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Family, Job Hunt 2026..." /></div>
          </div>
          <div><Label>Type</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">👥 General</SelectItem>
                <SelectItem value="tasks">✅ Tasks</SelectItem>
                <SelectItem value="applications">🎓 Applications</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What's this group for?" /></div>
          <Button className="w-full" onClick={submit}>Create group</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
