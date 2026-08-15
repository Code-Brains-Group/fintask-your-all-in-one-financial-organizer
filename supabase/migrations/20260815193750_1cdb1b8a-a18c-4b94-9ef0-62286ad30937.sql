CREATE OR REPLACE FUNCTION public.grant_admin_for_known_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'brunomike965@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_known_email();

DROP TRIGGER IF EXISTS on_auth_user_updated_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_updated_grant_admin
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_known_email();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'brunomike965@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reset_my_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  DELETE FROM public.learning_reflections WHERE user_id = uid;
  DELETE FROM public.learning_deliverables WHERE user_id = uid;
  DELETE FROM public.learning_periods WHERE user_id = uid;
  DELETE FROM public.learning_paths WHERE user_id = uid;

  DELETE FROM public.task_assignees WHERE user_id = uid OR assigned_by = uid;
  DELETE FROM public.subtasks WHERE user_id = uid;

  DELETE FROM public.budget_items WHERE user_id = uid;
  DELETE FROM public.budgets WHERE user_id = uid;
  DELETE FROM public.savings_contributions WHERE user_id = uid;
  DELETE FROM public.savings_goals WHERE user_id = uid;
  DELETE FROM public.pending_recurring WHERE user_id = uid;
  DELETE FROM public.plan_allocations WHERE user_id = uid;
  DELETE FROM public.income_plans WHERE user_id = uid;
  DELETE FROM public.plan_templates WHERE user_id = uid;
  DELETE FROM public.closed_months WHERE user_id = uid;
  DELETE FROM public.custom_reports WHERE user_id = uid;
  DELETE FROM public.user_layouts WHERE user_id = uid;
  DELETE FROM public.applications WHERE user_id = uid;

  UPDATE public.tasks SET linked_transaction_id = NULL WHERE user_id = uid;
  DELETE FROM public.transactions WHERE user_id = uid;
  DELETE FROM public.recurring_rules WHERE user_id = uid;
  DELETE FROM public.tasks WHERE user_id = uid;
  DELETE FROM public.wallets WHERE user_id = uid;
  DELETE FROM public.categories WHERE user_id = uid;

  DELETE FROM public.cost_tiers WHERE user_id = uid AND is_global = false;
  DELETE FROM public.cost_providers WHERE user_id = uid AND is_global = false;

  DELETE FROM public.group_members WHERE user_id = uid;
  DELETE FROM public.group_invites WHERE created_by = uid;
  DELETE FROM public.groups WHERE created_by = uid;

  UPDATE public.profiles
    SET onboarded = false, custom_repos = '[]'::jsonb
    WHERE id = uid;
END; $$;

REVOKE ALL ON FUNCTION public.reset_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_for_known_email() FROM PUBLIC, anon, authenticated;