
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planned_cost numeric;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS month text;

CREATE TABLE IF NOT EXISTS public.pending_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_recurring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pending" ON public.pending_recurring FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  name text NOT NULL,
  planned_amount numeric NOT NULL DEFAULT 0,
  purchased boolean NOT NULL DEFAULT false,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budget items" ON public.budget_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
