
ALTER TABLE public.learning_deliverables ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE public.learning_reflections ADD COLUMN IF NOT EXISTS deliverable_id uuid;
CREATE INDEX IF NOT EXISTS idx_learning_reflections_deliverable ON public.learning_reflections(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_learning_deliverables_task ON public.learning_deliverables(task_id);
