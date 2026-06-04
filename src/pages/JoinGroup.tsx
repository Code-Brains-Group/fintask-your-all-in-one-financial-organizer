import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { toast } from "sonner";

export default function JoinGroup() {
  const { code = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: inv } = await supabase.from("group_invites").select("*").eq("code", code.toUpperCase()).maybeSingle();
      if (!inv) { setError("Invite not found"); return; }
      if (!inv.active) { setError("Invite is no longer active"); return; }
      setInvite(inv);
      const { data: g } = await supabase.from("groups").select("id,name,emoji,description,kind").eq("id", inv.group_id).maybeSingle();
      setGroup(g);
    })();
  }, [code]);

  const accept = async () => {
    if (!user) { navigate(`/auth?redirect=/join/${code}`); return; }
    setBusy(true);
    const { error } = await supabase.rpc("accept_group_invite", { _code: code.toUpperCase() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Joined ${group?.name || "group"}!`);
    navigate("/groups");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-6xl">{group?.emoji || "👥"}</div>
          {error ? (
            <>
              <h1 className="text-xl font-semibold text-danger">{error}</h1>
              <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
            </>
          ) : !invite || !group ? (
            <div className="skeleton h-20" />
          ) : (
            <>
              <h1 className="text-2xl font-bold">You're invited to</h1>
              <div className="text-xl font-semibold text-primary">{group.name}</div>
              {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
              <div className="text-xs text-muted-foreground"><Users className="h-3 w-3 inline mr-1" /> Group · {group.kind}</div>
              {loading ? <div className="skeleton h-10" /> : (
                <Button className="w-full" onClick={accept} disabled={busy}>
                  {!user ? "Sign in to join" : busy ? "Joining…" : "Accept invitation"}
                </Button>
              )}
              <Button asChild variant="ghost" className="w-full"><Link to="/">Maybe later</Link></Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
