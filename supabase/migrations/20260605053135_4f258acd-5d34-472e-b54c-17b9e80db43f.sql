
-- Add group scope to savings
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.savings_contributions ADD COLUMN IF NOT EXISTS group_id uuid;

-- Admin helper
CREATE OR REPLACE FUNCTION public.is_group_admin(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group AND user_id = _user AND role IN ('owner','admin')
  ) OR EXISTS (
    SELECT 1 FROM public.groups WHERE id = _group AND created_by = _user
  )
$$;

-- Replace savings_goals RLS with group-aware policy
DROP POLICY IF EXISTS "own goals" ON public.savings_goals;
CREATE POLICY "goals own or group view" ON public.savings_goals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())));
CREATE POLICY "goals own write" ON public.savings_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals own update" ON public.savings_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals own delete" ON public.savings_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Replace savings_contributions RLS
DROP POLICY IF EXISTS "own contribs" ON public.savings_contributions;
CREATE POLICY "contribs own or group view" ON public.savings_contributions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())));
CREATE POLICY "contribs own write" ON public.savings_contributions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contribs own update" ON public.savings_contributions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contribs own delete" ON public.savings_contributions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow admins to update group_members roles
CREATE POLICY "members admin update role" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

-- Allow admins to delete members (in addition to existing self-leave / owner delete)
DROP POLICY IF EXISTS "members leave or remove by owner" ON public.group_members;
CREATE POLICY "members leave or admin remove" ON public.group_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
    OR public.is_group_admin(group_id, auth.uid())
  );

-- Allow admins to create invites
DROP POLICY IF EXISTS "invites create by group member" ON public.group_invites;
CREATE POLICY "invites create by admin or owner" ON public.group_invites
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_group_admin(group_id, auth.uid()));
