
-- 1. Close-month feature
CREATE TABLE public.closed_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by_name text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  insights text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_months TO authenticated;
GRANT ALL ON public.closed_months TO service_role;
ALTER TABLE public.closed_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own closed months" ON public.closed_months FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. User custom saving repository types on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_repos jsonb NOT NULL DEFAULT '[]'::jsonb;
