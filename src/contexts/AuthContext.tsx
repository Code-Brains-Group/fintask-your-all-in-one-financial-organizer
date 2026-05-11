import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFocus = "tasks" | "finance" | "both";
export type ModuleKey = "finance" | "tasks" | "applications";

export type FiscalConfig = { monthStartDay: number; yearStartMonth: number };

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  focus: FeatureFocus;
  modules: ModuleKey[];
  hasModule: (m: ModuleKey) => boolean;
  fiscal: FiscalConfig;
  refreshFocus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, focus: "both",
  modules: ["finance","tasks","applications"], hasModule: () => true,
  fiscal: { monthStartDay: 1, yearStartMonth: 1 },
  refreshFocus: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<FeatureFocus>("both");
  const [modules, setModules] = useState<ModuleKey[]>(["finance","tasks","applications"]);
  const [fiscal, setFiscal] = useState<FiscalConfig>({ monthStartDay: 1, yearStartMonth: 1 });

  const loadFocus = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles")
      .select("feature_focus,modules,fiscal_month_start_day,fiscal_year_start_month")
      .eq("id", uid).maybeSingle();
    if (data?.feature_focus) setFocus(data.feature_focus as FeatureFocus);
    if ((data as any)?.modules?.length) setModules((data as any).modules as ModuleKey[]);
    setFiscal({
      monthStartDay: (data as any)?.fiscal_month_start_day ?? 1,
      yearStartMonth: (data as any)?.fiscal_year_start_month ?? 1,
    });
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
  const hasModule = (m: ModuleKey) => modules.includes(m);

  return <Ctx.Provider value={{ user: session?.user ?? null, session, loading, focus, modules, hasModule, fiscal, refreshFocus, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
