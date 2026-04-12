-- Hotfix: restore lecturer tenant isolation and remove unsafe anonymous access

-- Remove dangerous anonymous read policies if present
DROP POLICY IF EXISTS "Anon can read grades" ON public.grades;
DROP POLICY IF EXISTS "Anon can read submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anon can read assignments" ON public.assignments;

-- Remove uploaded_by-based lecturer policies introduced by later migration
DROP POLICY IF EXISTS "Lecturers can view submissions they uploaded" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can update submissions they uploaded" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can manage grades" ON public.grades;

-- Restore lecturer ownership enforcement through assignments. Use text casts because
-- a prior migration changed submissions.assignment_id from uuid to text.
CREATE POLICY "Lecturers can view submissions for their assignments"
ON public.submissions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
);

CREATE POLICY "Lecturers can update submissions for their assignments"
ON public.submissions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
);

CREATE POLICY "Lecturers can insert submissions for their assignments"
ON public.submissions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id::text = public.submissions.assignment_id::text
      AND a.lecturer_id = auth.uid()
  )
);

CREATE POLICY "Lecturers can manage grades for their assignments"
ON public.grades
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a
      ON a.id::text = s.assignment_id::text
    WHERE s.id = public.grades.submission_id
      AND a.lecturer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a
      ON a.id::text = s.assignment_id::text
    WHERE s.id = public.grades.submission_id
      AND a.lecturer_id = auth.uid()
  )
);
