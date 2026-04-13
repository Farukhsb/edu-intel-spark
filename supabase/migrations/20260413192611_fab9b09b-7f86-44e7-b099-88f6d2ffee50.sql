
CREATE TABLE public.student_interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lecturer_id UUID NOT NULL,
  student_id UUID,
  student_name TEXT NOT NULL,
  student_email TEXT,
  intervention_type TEXT NOT NULL CHECK (intervention_type IN ('email', 'meeting', 'feedback', 'support_referral', 'check_in', 'other')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  notes TEXT,
  follow_up_date TIMESTAMPTZ,
  assignment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_interventions_lecturer_id ON public.student_interventions (lecturer_id);
CREATE INDEX idx_student_interventions_student_id ON public.student_interventions (student_id);
CREATE INDEX idx_student_interventions_status ON public.student_interventions (status);
CREATE INDEX idx_student_interventions_follow_up_date ON public.student_interventions (follow_up_date);

CREATE TRIGGER update_student_interventions_updated_at
  BEFORE UPDATE ON public.student_interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecturers can view own interventions"
  ON public.student_interventions FOR SELECT
  TO authenticated
  USING (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can insert own interventions"
  ON public.student_interventions FOR INSERT
  TO authenticated
  WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can update own interventions"
  ON public.student_interventions FOR UPDATE
  TO authenticated
  USING (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can delete own interventions"
  ON public.student_interventions FOR DELETE
  TO authenticated
  USING (lecturer_id = auth.uid());
