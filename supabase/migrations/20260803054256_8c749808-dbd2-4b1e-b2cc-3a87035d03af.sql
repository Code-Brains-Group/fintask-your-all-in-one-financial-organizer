CREATE TABLE public.income_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL,
  total_income numeric NOT NULL DEFAULT 0,
  strategy text NOT NULL DEFAULT 'amount',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_plans TO authenticated;
GRANT ALL ON public.income_plans TO service_role;
ALTER TABLE public.income_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own income plans" ON public.income_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_income_plans_updated_at BEFORE UPDATE ON public.income_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.plan_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.income_plans(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  label text,
  percent numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'spend',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_allocations TO authenticated;
GRANT ALL ON public.plan_allocations TO service_role;
ALTER TABLE public.plan_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own plan allocations" ON public.plan_allocations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_plan_allocations_updated_at BEFORE UPDATE ON public.plan_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();