
-- 1. Restrict group_invites SELECT to group admins/creators only.
DROP POLICY IF EXISTS "invites readable" ON public.group_invites;
CREATE POLICY "invites readable by group admins"
  ON public.group_invites FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

-- 2. Safe RPC to preview an invite by code (no listing possible).
CREATE OR REPLACE FUNCTION public.get_invite_preview(_code text)
RETURNS TABLE(group_id uuid, group_name text, group_emoji text, group_description text, group_kind text, active boolean, expired boolean, exhausted boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.group_invites%rowtype;
BEGIN
  SELECT * INTO inv FROM public.group_invites WHERE code = upper(_code) LIMIT 1;
  IF inv.id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.emoji, g.description, g.kind::text,
         inv.active,
         (inv.expires_at IS NOT NULL AND inv.expires_at < now()),
         (inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses)
  FROM public.groups g WHERE g.id = inv.group_id;
END; $$;

REVOKE ALL ON FUNCTION public.get_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

-- 3. Revoke EXECUTE on all SECURITY DEFINER functions from PUBLIC/anon/authenticated,
--    then re-grant only what's needed.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_complete_parent_task() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_group_creator_as_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_group_member_display_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_group_member_names() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_dump_schema() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_user(uuid, boolean, boolean, text[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_group_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Re-grant only what signed-in users legitimately need.
GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user(uuid, boolean, boolean, text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dump_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
