import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  isAdmin: boolean;
  premium: boolean;
  refreshFocus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, focus: "both",
  modules: ["finance","tasks","applications"], hasModule: () => true,
  fiscal: { monthStartDay: 1, yearStartMonth: 1 },
  isAdmin: false, premium: false,
  refreshFocus: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<FeatureFocus>("both");
  const [modules, setModules] = useState<ModuleKey[]>(["finance","tasks","applications"]);
  const [fiscal, setFiscal] = useState<FiscalConfig>({ monthStartDay: 1, yearStartMonth: 1 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [premium, setPremium] = useState(false);

  const loadFocus = useCallback(async (uid: string) => {
    const [{ data }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles")
        .select("feature_focus,modules,fiscal_month_start_day,fiscal_year_start_month,is_active,premium")
        .eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
    ]);
    if ((data as any)?.is_active === false) {
      toast.error("Your account has been deactivated. Contact your administrator.");
      await supabase.auth.signOut();
      return;
    }
    if (data?.feature_focus) setFocus(data.feature_focus as FeatureFocus);
    if ((data as any)?.modules?.length) setModules((data as any).modules as ModuleKey[]);
    setFiscal({
      monthStartDay: (data as any)?.fiscal_month_start_day ?? 1,
      yearStartMonth: (data as any)?.fiscal_year_start_month ?? 1,
    });
    setPremium(!!(data as any)?.premium);
    setIsAdmin(!!roleRow);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (s?.user) setTimeout(() => loadFocus(s.user.id), 0);
      else { setIsAdmin(false); setPremium(false); }
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

  return <Ctx.Provider value={{ user: session?.user ?? null, session, loading, focus, modules, hasModule, fiscal, isAdmin, premium, refreshFocus, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
