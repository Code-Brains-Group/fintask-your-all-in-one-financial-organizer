
-- 1. Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "roles self view" ON public.user_roles;
CREATE POLICY "roles self view" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 2. Profile flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS premium boolean NOT NULL DEFAULT false;

-- Admin can view + update all profiles
DROP POLICY IF EXISTS "admin view all profiles" ON public.profiles;
CREATE POLICY "admin view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin update all profiles" ON public.profiles;
CREATE POLICY "admin update all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Global transaction costs (admin-managed). Allow user_id NULL for global rows.
ALTER TABLE public.cost_providers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.cost_tiers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.cost_providers ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;
ALTER TABLE public.cost_tiers ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "global providers read" ON public.cost_providers;
CREATE POLICY "global providers read" ON public.cost_providers FOR SELECT TO authenticated
  USING (is_global = true OR user_id = auth.uid());
DROP POLICY IF EXISTS "admin manage global providers" ON public.cost_providers;
CREATE POLICY "admin manage global providers" ON public.cost_providers FOR ALL TO authenticated
  USING (is_global = true AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (is_global = true AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "global tiers read" ON public.cost_tiers;
CREATE POLICY "global tiers read" ON public.cost_tiers FOR SELECT TO authenticated
  USING (is_global = true OR user_id = auth.uid());
DROP POLICY IF EXISTS "admin manage global tiers" ON public.cost_tiers;
CREATE POLICY "admin manage global tiers" ON public.cost_tiers FOR ALL TO authenticated
  USING (is_global = true AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (is_global = true AND public.has_role(auth.uid(),'admin'));

-- 4. RPC for admin to list users with emails
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, created_at timestamptz, is_active boolean, premium boolean, modules text[], display_name text, is_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, p.is_active, p.premium, p.modules, p.display_name,
         public.has_role(u.id,'admin') AS is_admin
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 5. Admin actions: toggle role / active / premium / modules
CREATE OR REPLACE FUNCTION public.admin_set_user(_target uuid, _is_active boolean, _premium boolean, _modules text[], _is_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.profiles SET
    is_active = COALESCE(_is_active, is_active),
    premium   = COALESCE(_premium, premium),
    modules   = COALESCE(_modules, modules)
  WHERE id = _target;
  IF _is_admin IS NOT NULL THEN
    IF _is_admin THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (_target,'admin') ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.user_roles WHERE user_id = _target AND role='admin';
    END IF;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_user(uuid, boolean, boolean, text[], boolean) TO authenticated;

-- 6. Bootstrap brunomike965@gmail.com as admin if exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'brunomike965@gmail.com'
ON CONFLICT DO NOTHING;
