
CREATE TABLE public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid,
  title text NOT NULL,
  topic text,
  description text,
  emoji text DEFAULT '📚',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paths own or group view" ON public.learning_paths FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())));
CREATE POLICY "paths own write" ON public.learning_paths FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paths own update" ON public.learning_paths FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "paths own delete" ON public.learning_paths FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER trg_lp_updated BEFORE UPDATE ON public.learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.learning_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_number int NOT NULL DEFAULT 1,
  title text NOT NULL,
  focus text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planned',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_periods TO authenticated;
GRANT ALL ON public.learning_periods TO service_role;
ALTER TABLE public.learning_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods access via path" ON public.learning_periods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_paths p WHERE p.id = path_id
    AND (p.user_id = auth.uid() OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.learning_paths p WHERE p.id = path_id
    AND (p.user_id = auth.uid() OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, auth.uid())))));
CREATE TRIGGER trg_lpe_updated BEFORE UPDATE ON public.learning_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.learning_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.learning_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_deliverables TO authenticated;
GRANT ALL ON public.learning_deliverables TO service_role;
ALTER TABLE public.learning_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliverables access via period" ON public.learning_deliverables FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_periods pe JOIN public.learning_paths p ON p.id = pe.path_id
    WHERE pe.id = period_id AND (p.user_id = auth.uid() OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.learning_periods pe JOIN public.learning_paths p ON p.id = pe.path_id
    WHERE pe.id = period_id AND (p.user_id = auth.uid() OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, auth.uid())))));

CREATE TABLE public.learning_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.learning_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  learned text,
  challenges text,
  next_steps text,
  rating int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_reflections TO authenticated;
GRANT ALL ON public.learning_reflections TO service_role;
ALTER TABLE public.learning_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reflections view via path" ON public.learning_reflections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learning_paths p WHERE p.id = path_id
    AND (p.user_id = auth.uid() OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, auth.uid())))));
CREATE POLICY "reflections own write" ON public.learning_reflections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.learning_paths p WHERE p.id = path_id
    AND (p.user_id = auth.uid() OR (p.group_id IS NOT NULL AND public.is_group_member(p.group_id, auth.uid())))));
CREATE POLICY "reflections own update" ON public.learning_reflections FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reflections own delete" ON public.learning_reflections FOR DELETE TO authenticated
  USING (user_id = auth.uid());
