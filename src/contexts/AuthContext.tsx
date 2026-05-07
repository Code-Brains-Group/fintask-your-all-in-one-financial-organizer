import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFocus = "tasks" | "finance" | "both";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  focus: FeatureFocus;
  refreshFocus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, focus: "both",
  refreshFocus: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<FeatureFocus>("both");

  const loadFocus = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("feature_focus").eq("id", uid).maybeSingle();
    if (data?.feature_focus) setFocus(data.feature_focus as FeatureFocus);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (s?.user) setTimeout(() => loadFocus(s.user.id), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) loadFocus(data.session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadFocus]);

  const refreshFocus = async () => { if (session?.user) await loadFocus(session.user.id); };
  const signOut = async () => { await supabase.auth.signOut(); };

  return <Ctx.Provider value={{ user: session?.user ?? null, session, loading, focus, refreshFocus, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
