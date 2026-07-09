
-- user_layouts: per-user widget layout per surface
CREATE TABLE public.user_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('dashboard','reports')),
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surface)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_layouts TO authenticated;
GRANT ALL ON public.user_layouts TO service_role;
ALTER TABLE public.user_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own layouts" ON public.user_layouts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_layouts_updated
  BEFORE UPDATE ON public.user_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- custom_reports: user-defined reports
CREATE TABLE public.custom_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '📊',
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  share_token text UNIQUE,
  share_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_reports TO authenticated;
GRANT ALL ON public.custom_reports TO service_role;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reports" ON public.custom_reports
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER custom_reports_updated
  BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX custom_reports_user_idx ON public.custom_reports(user_id);
CREATE INDEX custom_reports_pinned_idx ON public.custom_reports(user_id) WHERE is_pinned;

-- Public read via share token only
CREATE OR REPLACE FUNCTION public.get_shared_report(_token text)
RETURNS TABLE(id uuid, name text, emoji text, description text, config jsonb, owner_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.name, r.emoji, r.description, r.config,
         COALESCE(p.display_name, 'A FinTask user') AS owner_name
  FROM public.custom_reports r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.share_token = _token
    AND (r.share_expires_at IS NULL OR r.share_expires_at > now());
END; $$;

GRANT EXECUTE ON FUNCTION public.get_shared_report(text) TO anon, authenticated;
