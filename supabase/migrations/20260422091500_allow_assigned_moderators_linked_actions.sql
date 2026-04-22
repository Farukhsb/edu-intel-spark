-- Additive moderation-linked access for specifically assigned moderators.
-- Scope: only rows tied to moderation_cases where moderator_id = auth.uid().
-- This preserves existing owner-lecturer protections.

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

CREATE POLICY "Assigned moderators can update linked submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.submissions.id
      AND mc.moderator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.submissions.id
      AND mc.moderator_id = auth.uid()
  )
);

CREATE POLICY "Assigned moderators can view linked grades"
ON public.grades
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.grade_id = public.grades.id
      AND mc.moderator_id = auth.uid()
  )
);

CREATE POLICY "Assigned moderators can view linked integrity reviews"
ON public.academic_integrity_reviews
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.academic_integrity_reviews.submission_id
      AND mc.moderator_id = auth.uid()
  )
);
