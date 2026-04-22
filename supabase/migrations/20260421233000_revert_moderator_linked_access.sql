-- Roll back the moderator-linked data visibility change and return to the
-- earlier moderation behavior where assignment ownership primarily governed
-- linked assignment/submission/grade/integrity reads.

DROP POLICY IF EXISTS "Moderation participants can view linked assignments" ON public.assignments;
DROP POLICY IF EXISTS "Moderation participants can view linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Moderation participants can update linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Moderation participants can view linked grades" ON public.grades;
DROP POLICY IF EXISTS "Moderation participants can view linked integrity reviews" ON public.academic_integrity_reviews;
