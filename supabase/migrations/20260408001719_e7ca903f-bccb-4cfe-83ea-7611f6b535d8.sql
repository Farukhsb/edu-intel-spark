
-- Drop ALL policies referencing assignment_id (directly or via JOIN)
DROP POLICY IF EXISTS "Lecturers can view submissions for their assignments" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can update submissions for their assignments" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can manage grades for their assignments" ON public.grades;

-- Now safe to change type
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey;
ALTER TABLE public.submissions ALTER COLUMN assignment_id TYPE text USING assignment_id::text;

-- Recreate submissions policies
CREATE POLICY "Lecturers can view submissions they uploaded"
ON public.submissions FOR SELECT TO authenticated
USING (uploaded_by = auth.uid());

CREATE POLICY "Lecturers can update submissions they uploaded"
ON public.submissions FOR UPDATE TO authenticated
USING (uploaded_by = auth.uid());

CREATE POLICY "Lecturers can insert submissions"
ON public.submissions FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Recreate grades policy for lecturers (simplified: lecturer who uploaded the submission)
CREATE POLICY "Lecturers can manage grades"
ON public.grades FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM submissions s WHERE s.id = grades.submission_id AND s.uploaded_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM submissions s WHERE s.id = grades.submission_id AND s.uploaded_by = auth.uid()
));
