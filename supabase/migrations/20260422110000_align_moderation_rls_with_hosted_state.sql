-- Align moderation RLS with the verified hosted working state.
-- This removes the recursive assignments -> moderation_cases -> assignments path
-- and keeps only the linked read access actually required for the working UI.

DROP POLICY IF EXISTS "Lecturers can view assigned moderation cases" ON public.moderation_cases;
CREATE POLICY "Lecturers can view assigned moderation cases"
ON public.moderation_cases
FOR SELECT
TO authenticated
USING (
  lecturer_id = auth.uid()
  OR first_marker_id = auth.uid()
  OR moderator_id = auth.uid()
);

DROP POLICY IF EXISTS "Assigned moderators can view linked assignments" ON public.assignments;
CREATE POLICY "Assigned moderators can view linked assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.assignment_id = public.assignments.id
      AND mc.moderator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Assigned moderators can view linked submissions" ON public.submissions;
CREATE POLICY "Assigned moderators can view linked submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.submissions.id
      AND mc.moderator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Assigned moderators can update linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Assigned moderators can view linked grades" ON public.grades;
DROP POLICY IF EXISTS "Assigned moderators can view linked integrity reviews" ON public.academic_integrity_reviews;
