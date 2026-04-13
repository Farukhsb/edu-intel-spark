-- Restore lecturer access based on assignment ownership and tighten insert rules.

DROP POLICY IF EXISTS "Lecturers can view submissions they uploaded" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can update submissions they uploaded" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can manage grades" ON public.grades;

CREATE POLICY "Students can submit to published assignments"
ON public.submissions FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = submissions.assignment_id
      AND a.status = 'published'
  )
);

CREATE POLICY "Lecturers can upload submissions for own assignments"
ON public.submissions FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = submissions.assignment_id
      AND a.lecturer_id = auth.uid()
  )
);

CREATE POLICY "Lecturers can view submissions for own assignments"
ON public.submissions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = submissions.assignment_id
      AND a.lecturer_id = auth.uid()
  )
);

CREATE POLICY "Lecturers can update submissions for own assignments"
ON public.submissions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = submissions.assignment_id
      AND a.lecturer_id = auth.uid()
  )
);

CREATE POLICY "Lecturers can manage grades for own assignments"
ON public.grades FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a
      ON a.id::text = s.assignment_id
    WHERE s.id = grades.submission_id
      AND a.lecturer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a
      ON a.id::text = s.assignment_id
    WHERE s.id = grades.submission_id
      AND a.lecturer_id = auth.uid()
  )
);
