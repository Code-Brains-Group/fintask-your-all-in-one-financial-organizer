
-- Groups
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  description text,
  emoji text DEFAULT '👥',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invites TO authenticated;
GRANT SELECT ON public.group_invites TO anon;
GRANT ALL ON public.group_invites TO service_role;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Add group_id to tasks & applications
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- Security definer helper: is the user a member of a group?
CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user)
$$;

-- Replace tasks RLS to allow group members
DROP POLICY IF EXISTS "own tasks" ON public.tasks;
CREATE POLICY "tasks own or group" ON public.tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
  WITH CHECK (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())));

DROP POLICY IF EXISTS "own applications" ON public.applications;
CREATE POLICY "applications own or group" ON public.applications FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
  WITH CHECK (auth.uid() = user_id OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())));

DROP POLICY IF EXISTS "own subtasks" ON public.subtasks;
CREATE POLICY "subtasks own or group" ON public.subtasks FOR ALL TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = subtasks.task_id AND t.group_id IS NOT NULL AND public.is_group_member(t.group_id, auth.uid()))
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = subtasks.task_id AND t.group_id IS NOT NULL AND public.is_group_member(t.group_id, auth.uid()))
  );

-- Groups RLS
CREATE POLICY "groups view if member or creator" ON public.groups FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_group_member(id, auth.uid()));
CREATE POLICY "groups create" ON public.groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups owner update" ON public.groups FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups owner delete" ON public.groups FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Members RLS
CREATE POLICY "members view group peers" ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members insert self" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "members leave or remove by owner" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid()));

-- Invites RLS: readable so users can preview a group before accepting; writes restricted
CREATE POLICY "invites readable" ON public.group_invites FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "invites create by group member" ON public.group_invites FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_group_member(group_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())));
CREATE POLICY "invites update by creator" ON public.group_invites FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "invites delete by creator" ON public.group_invites FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Assignees RLS
CREATE POLICY "assignees access" ON public.task_assignees FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR assigned_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.user_id = auth.uid() OR (t.group_id IS NOT NULL AND public.is_group_member(t.group_id, auth.uid()))))
  )
  WITH CHECK (
    assigned_by = auth.uid() OR user_id = auth.uid()
  );

-- Auto-add group creator as owner member
CREATE OR REPLACE FUNCTION public.add_group_creator_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_add_group_creator
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_group_creator_as_member();

-- Subtask auto-complete parent
CREATE OR REPLACE FUNCTION public.auto_complete_parent_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining int;
  total int;
  tid uuid;
BEGIN
  tid := COALESCE(NEW.task_id, OLD.task_id);
  SELECT COUNT(*) FILTER (WHERE NOT done), COUNT(*) INTO remaining, total
  FROM public.subtasks WHERE task_id = tid;
  IF total > 0 AND remaining = 0 THEN
    UPDATE public.tasks SET status = 'done', completed_at = now()
    WHERE id = tid AND status <> 'done';
  ELSIF total > 0 AND remaining > 0 THEN
    UPDATE public.tasks SET status = CASE WHEN status = 'done' THEN 'in_progress' ELSE status END,
                            completed_at = NULL
    WHERE id = tid AND status = 'done';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_auto_complete_parent
AFTER INSERT OR UPDATE OR DELETE ON public.subtasks
FOR EACH ROW EXECUTE FUNCTION public.auto_complete_parent_task();

-- Updated_at trigger for groups
CREATE TRIGGER trg_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Accept invite RPC
CREATE OR REPLACE FUNCTION public.accept_group_invite(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.group_invites%rowtype;
BEGIN
  SELECT * INTO inv FROM public.group_invites WHERE code = _code AND active = true LIMIT 1;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invalid or inactive invite code'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'Invite has expired'; END IF;
  IF inv.max_uses IS NOT NULL AND inv.uses >= inv.max_uses THEN RAISE EXCEPTION 'Invite has reached max uses'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (inv.group_id, auth.uid(), 'member') ON CONFLICT DO NOTHING;
  UPDATE public.group_invites SET uses = uses + 1 WHERE id = inv.id;
  RETURN inv.group_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;
