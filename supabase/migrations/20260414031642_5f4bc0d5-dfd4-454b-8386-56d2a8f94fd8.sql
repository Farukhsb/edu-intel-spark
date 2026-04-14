
-- =============================================
-- Table: academic_integrity_reviews
-- =============================================
CREATE TABLE public.academic_integrity_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  lecturer_id uuid NOT NULL,
  review_type text NOT NULL CHECK (review_type IN ('ai-writing-suspicion', 'similarity-plagiarism-suspicion')),
  decision text NOT NULL CHECK (decision IN ('clear', 'investigate', 'misconduct-concern')),
  evidence_summary text,
  lecturer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_air_submission_id ON public.academic_integrity_reviews (submission_id);
CREATE INDEX idx_air_lecturer_id ON public.academic_integrity_reviews (lecturer_id);

CREATE TRIGGER update_academic_integrity_reviews_updated_at
  BEFORE UPDATE ON public.academic_integrity_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.academic_integrity_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecturers can view own reviews"
  ON public.academic_integrity_reviews FOR SELECT
  TO authenticated
  USING (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can insert own reviews"
  ON public.academic_integrity_reviews FOR INSERT
  TO authenticated
  WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can update own reviews"
  ON public.academic_integrity_reviews FOR UPDATE
  TO authenticated
  USING (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can delete own reviews"
  ON public.academic_integrity_reviews FOR DELETE
  TO authenticated
  USING (lecturer_id = auth.uid());

-- =============================================
-- Table: improvement_plan_progress
-- =============================================
CREATE TABLE public.improvement_plan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  task_key text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, task_key)
);

CREATE INDEX idx_ipp_student_id ON public.improvement_plan_progress (student_id);

CREATE TRIGGER update_improvement_plan_progress_updated_at
  BEFORE UPDATE ON public.improvement_plan_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.improvement_plan_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own progress"
  ON public.improvement_plan_progress FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own progress"
  ON public.improvement_plan_progress FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own progress"
  ON public.improvement_plan_progress FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Lecturers can view all progress"
  ON public.improvement_plan_progress FOR SELECT
  TO authenticated
  USING (public.is_lecturer());
