CREATE TABLE public.plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🧧',
  strategy text NOT NULL DEFAULT 'percent',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_templates TO authenticated;
GRANT ALL ON public.plan_templates TO service_role;

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own plan templates"
ON public.plan_templates FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER plan_templates_updated_at
BEFORE UPDATE ON public.plan_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();