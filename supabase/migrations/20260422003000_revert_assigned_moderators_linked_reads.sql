-- Revert the additive linked-read policies introduced for assigned moderators.
-- This returns moderation visibility to the earlier behavior without rewriting
-- migration history.

DROP POLICY IF EXISTS "Assigned moderators can view linked assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assigned moderators can view linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Assigned moderators can update linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Assigned moderators can view linked grades" ON public.grades;
DROP POLICY IF EXISTS "Assigned moderators can view linked integrity reviews" ON public.academic_integrity_reviews;
