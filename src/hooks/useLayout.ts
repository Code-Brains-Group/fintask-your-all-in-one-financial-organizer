import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WidgetState = {
  id: string;      // stable widget instance id
  type: string;    // widget kind
  visible: boolean;
  settings?: Record<string, any>;
};

const LS_KEY = (uid: string, surface: string) => `ft.layout.${uid}.${surface}`;

export function useLayout(surface: "dashboard" | "reports", defaults: WidgetState[]) {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<WidgetState[]>(defaults);
  const [loaded, setLoaded] = useState(false);

  // hydrate from localStorage first for instant paint
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(LS_KEY(user.id, surface));
      if (raw) setWidgets(mergeDefaults(JSON.parse(raw), defaults));
    } catch {}
  }, [user?.id, surface]);

  // then load canonical from Cloud
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_layouts")
        .select("widgets")
        .eq("user_id", user.id)
        .eq("surface", surface)
        .maybeSingle();
      if (data?.widgets && Array.isArray(data.widgets)) {
        const merged = mergeDefaults(data.widgets, defaults);
        setWidgets(merged);
        localStorage.setItem(LS_KEY(user.id, surface), JSON.stringify(merged));
      }
      setLoaded(true);
    })();
  }, [user?.id, surface]);

  const save = useCallback(async (next: WidgetState[]) => {
    setWidgets(next);
    if (!user) return;
    localStorage.setItem(LS_KEY(user.id, surface), JSON.stringify(next));
    await (supabase as any)
      .from("user_layouts")
      .upsert({ user_id: user.id, surface, widgets: next }, { onConflict: "user_id,surface" });
  }, [user?.id, surface]);

  const reset = useCallback(() => save(defaults), [save, defaults]);
  const toggle = useCallback((id: string) => {
    save(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  }, [widgets, save]);
  const reorder = useCallback((from: number, to: number) => {
    const next = [...widgets];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    save(next);
  }, [widgets, save]);
  const addWidget = useCallback((w: WidgetState) => {
    save([...widgets, w]);
  }, [widgets, save]);
  const removeWidget = useCallback((id: string) => {
    save(widgets.filter(w => w.id !== id));
  }, [widgets, save]);
  const updateSettings = useCallback((id: string, settings: Record<string, any>) => {
    save(widgets.map(w => w.id === id ? { ...w, settings: { ...w.settings, ...settings } } : w));
  }, [widgets, save]);

  return { widgets, loaded, save, reset, toggle, reorder, addWidget, removeWidget, updateSettings };
}

// Ensure newly-shipped default widgets appear for existing users, but keep their order/state for known ones
function mergeDefaults(stored: WidgetState[], defaults: WidgetState[]): WidgetState[] {
  const known = new Set(stored.map(w => w.id));
  const additions = defaults.filter(d => !known.has(d.id));
  return [...stored, ...additions];
}
