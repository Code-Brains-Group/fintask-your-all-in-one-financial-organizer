
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT ARRAY['finance','tasks','applications']::text[],
  ADD COLUMN IF NOT EXISTS fiscal_month_start_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month integer NOT NULL DEFAULT 1;

ALTER TABLE public.recurring_rules
  ADD COLUMN IF NOT EXISTS align_fiscal boolean NOT NULL DEFAULT false;

-- Backfill modules from existing feature_focus
UPDATE public.profiles
SET modules = CASE
  WHEN feature_focus = 'finance' THEN ARRAY['finance','applications']
  WHEN feature_focus = 'tasks' THEN ARRAY['tasks','applications']
  ELSE ARRAY['finance','tasks','applications']
END
WHERE modules IS NULL OR array_length(modules, 1) IS NULL;
