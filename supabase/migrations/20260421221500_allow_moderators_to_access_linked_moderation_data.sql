-- Allow assigned moderation participants to read the linked assignment, submission,
-- grade, and integrity records required by the moderation workflow.

DROP POLICY IF EXISTS "Moderation participants can view linked assignments" ON public.assignments;
CREATE POLICY "Moderation participants can view linked assignments"
ON public.assignments
FOR SELECT TO authenticated
USING (
  lecturer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.assignment_id = public.assignments.id
      AND (
        mc.lecturer_id = auth.uid()
        OR mc.first_marker_id = auth.uid()
        OR mc.moderator_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Moderation participants can view linked submissions" ON public.submissions;
CREATE POLICY "Moderation participants can view linked submissions"
ON public.submissions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.submissions.id
      AND (
        mc.lecturer_id = auth.uid()
        OR mc.first_marker_id = auth.uid()
        OR mc.moderator_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Moderation participants can update linked submissions" ON public.submissions;
CREATE POLICY "Moderation participants can update linked submissions"
ON public.submissions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.submissions.id
      AND (
        mc.lecturer_id = auth.uid()
        OR mc.first_marker_id = auth.uid()
        OR mc.moderator_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.submissions.id
      AND (
        mc.lecturer_id = auth.uid()
        OR mc.first_marker_id = auth.uid()
        OR mc.moderator_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Moderation participants can view linked grades" ON public.grades;
CREATE POLICY "Moderation participants can view linked grades"
ON public.grades
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a
      ON a.id::text = s.assignment_id::text
    WHERE s.id = public.grades.submission_id
      AND a.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.grade_id = public.grades.id
      AND (
        mc.lecturer_id = auth.uid()
        OR mc.first_marker_id = auth.uid()
        OR mc.moderator_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Moderation participants can view linked integrity reviews" ON public.academic_integrity_reviews;
CREATE POLICY "Moderation participants can view linked integrity reviews"
ON public.academic_integrity_reviews
FOR SELECT TO authenticated
USING (
  lecturer_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.moderation_cases mc
    WHERE mc.submission_id = public.academic_integrity_reviews.submission_id
      AND (
        mc.lecturer_id = auth.uid()
        OR mc.first_marker_id = auth.uid()
        OR mc.moderator_id = auth.uid()
      )
  )
);
