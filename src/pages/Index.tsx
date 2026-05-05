import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Onboarding from "./Onboarding";
import Dashboard from "./Dashboard";

export default function Index() {
  const { user } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle()
      .then(({ data }) => setOnboarded(!!data?.onboarded));
  }, [user]);

  if (onboarded === null) return <div className="p-8 space-y-4"><div className="skeleton h-12 w-1/3" /><div className="skeleton h-64" /></div>;
  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;
  return <Dashboard />;
}
