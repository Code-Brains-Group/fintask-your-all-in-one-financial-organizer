
-- Backfill display_name from profiles
UPDATE public.group_members gm
SET display_name = p.display_name
FROM public.profiles p
WHERE gm.user_id = p.id
  AND (gm.display_name IS NULL OR gm.display_name = '');

-- Trigger to set display_name when a user joins a group
CREATE OR REPLACE FUNCTION public.set_group_member_display_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    SELECT display_name INTO NEW.display_name FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_group_member_display_name ON public.group_members;
CREATE TRIGGER trg_set_group_member_display_name
BEFORE INSERT ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.set_group_member_display_name();

-- Trigger to sync display_name when a user changes their profile name
CREATE OR REPLACE FUNCTION public.sync_group_member_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    UPDATE public.group_members SET display_name = NEW.display_name WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_group_member_names ON public.profiles;
CREATE TRIGGER trg_sync_group_member_names
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_group_member_names();
