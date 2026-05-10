-- Notification preferences + reminder defaults on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_applications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_budgets boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_lead_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false;

-- Per-task reminder override
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_minutes integer;

-- Per-application reminder offset (days before deadline)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS reminder_days_before integer DEFAULT 3;

-- Custom budget periods + recurrence
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;