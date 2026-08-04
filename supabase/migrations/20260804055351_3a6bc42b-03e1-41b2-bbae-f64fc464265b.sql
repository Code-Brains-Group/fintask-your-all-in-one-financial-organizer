ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS need_kind text;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_need_kind_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_need_kind_check CHECK (need_kind IS NULL OR need_kind IN ('need','want','savings'));