ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'first_review';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'moderation_pending';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'moderation_in_progress';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'moderated';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'escalated';

CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL,
  lecturer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_marker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'moderation_pending' CHECK (
    status IN ('first_review', 'moderation_pending', 'moderation_in_progress', 'moderated', 'escalated')
  ),
  trigger_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_summary TEXT,
  confidence_score NUMERIC,
  integrity_risk_score NUMERIC,
  ai_score_snapshot NUMERIC,
  first_marker_score NUMERIC,
  moderator_score NUMERIC,
  final_agreed_score NUMERIC,
  final_agreed_feedback TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  moderated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_assignment_id ON public.moderation_cases (assignment_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON public.moderation_cases (status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_moderator_id ON public.moderation_cases (moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_lecturer_id ON public.moderation_cases (lecturer_id);

CREATE TABLE IF NOT EXISTS public.moderation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_case_id UUID NOT NULL REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('first_marker', 'moderator', 'lecturer')),
  action TEXT NOT NULL CHECK (action IN ('agree', 'adjust', 'return', 'escalate', 'approve')),
  proposed_score NUMERIC,
  proposed_feedback TEXT,
  notes TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_reviews_case_id ON public.moderation_reviews (moderation_case_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reviews_submission_id ON public.moderation_reviews (submission_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reviews_reviewer_id ON public.moderation_reviews (reviewer_id);

CREATE TABLE IF NOT EXISTS public.grade_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE,
  moderation_case_id UUID REFERENCES public.moderation_cases(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_role TEXT,
  previous_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grade_audit_log_submission_id ON public.grade_audit_log (submission_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_log_grade_id ON public.grade_audit_log (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_log_case_id ON public.grade_audit_log (moderation_case_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_log_created_at ON public.grade_audit_log (created_at DESC);

ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecturers can view assigned moderation cases" ON public.moderation_cases;
CREATE POLICY "Lecturers can view assigned moderation cases"
  ON public.moderation_cases FOR SELECT
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    OR first_marker_id = auth.uid()
    OR moderator_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_id AND a.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lecturers can insert moderation cases" ON public.moderation_cases;
CREATE POLICY "Lecturers can insert moderation cases"
  ON public.moderation_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    lecturer_id = auth.uid()
    OR first_marker_id = auth.uid()
    OR moderator_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_id AND a.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lecturers can update moderation cases" ON public.moderation_cases;
CREATE POLICY "Lecturers can update moderation cases"
  ON public.moderation_cases FOR UPDATE
  TO authenticated
  USING (
    lecturer_id = auth.uid()
    OR first_marker_id = auth.uid()
    OR moderator_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_id AND a.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    lecturer_id = auth.uid()
    OR first_marker_id = auth.uid()
    OR moderator_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_id AND a.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lecturers can view moderation reviews" ON public.moderation_reviews;
CREATE POLICY "Lecturers can view moderation reviews"
  ON public.moderation_reviews FOR SELECT
  TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.moderation_cases mc
      WHERE mc.id = moderation_case_id
        AND (
          mc.lecturer_id = auth.uid()
          OR mc.first_marker_id = auth.uid()
          OR mc.moderator_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Lecturers can insert moderation reviews" ON public.moderation_reviews;
CREATE POLICY "Lecturers can insert moderation reviews"
  ON public.moderation_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.moderation_cases mc
      WHERE mc.id = moderation_case_id
        AND (
          mc.lecturer_id = auth.uid()
          OR mc.first_marker_id = auth.uid()
          OR mc.moderator_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Lecturers can view grade audit log" ON public.grade_audit_log;
CREATE POLICY "Lecturers can view grade audit log"
  ON public.grade_audit_log FOR SELECT
  TO authenticated
  USING (
    changed_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.moderation_cases mc
      WHERE mc.id = moderation_case_id
        AND mc.moderator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lecturers can insert grade audit log" ON public.grade_audit_log;
CREATE POLICY "Lecturers can insert grade audit log"
  ON public.grade_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id
        AND a.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.moderation_cases mc
      WHERE mc.id = moderation_case_id
        AND mc.moderator_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_moderation_cases_updated_at ON public.moderation_cases;
CREATE TRIGGER update_moderation_cases_updated_at
  BEFORE UPDATE ON public.moderation_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_grade_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.grade_audit_log (
      submission_id,
      grade_id,
      changed_by,
      event_type,
      actor_role,
      new_values
    )
    VALUES (
      NEW.submission_id,
      NEW.id,
      actor_id,
      'grade_created',
      CASE WHEN public.is_lecturer() THEN 'lecturer' ELSE 'system' END,
      jsonb_build_object(
        'ai_score', NEW.ai_score,
        'lecturer_score', NEW.lecturer_score,
        'final_score', NEW.final_score,
        'grading_confidence', NEW.grading_confidence
      )
    );

    RETURN NEW;
  END IF;

  IF ROW(
    OLD.ai_score,
    OLD.lecturer_score,
    OLD.final_score,
    OLD.ai_feedback,
    OLD.lecturer_feedback,
    OLD.final_feedback,
    OLD.reviewed_by,
    OLD.reviewed_at
  ) IS DISTINCT FROM ROW(
    NEW.ai_score,
    NEW.lecturer_score,
    NEW.final_score,
    NEW.ai_feedback,
    NEW.lecturer_feedback,
    NEW.final_feedback,
    NEW.reviewed_by,
    NEW.reviewed_at
  ) THEN
    INSERT INTO public.grade_audit_log (
      submission_id,
      grade_id,
      changed_by,
      event_type,
      actor_role,
      previous_values,
      new_values
    )
    VALUES (
      NEW.submission_id,
      NEW.id,
      actor_id,
      'grade_updated',
      CASE WHEN public.is_lecturer() THEN 'lecturer' ELSE 'system' END,
      jsonb_build_object(
        'ai_score', OLD.ai_score,
        'lecturer_score', OLD.lecturer_score,
        'final_score', OLD.final_score,
        'ai_feedback', OLD.ai_feedback,
        'lecturer_feedback', OLD.lecturer_feedback,
        'final_feedback', OLD.final_feedback,
        'reviewed_by', OLD.reviewed_by,
        'reviewed_at', OLD.reviewed_at
      ),
      jsonb_build_object(
        'ai_score', NEW.ai_score,
        'lecturer_score', NEW.lecturer_score,
        'final_score', NEW.final_score,
        'ai_feedback', NEW.ai_feedback,
        'lecturer_feedback', NEW.lecturer_feedback,
        'final_feedback', NEW.final_feedback,
        'reviewed_by', NEW.reviewed_by,
        'reviewed_at', NEW.reviewed_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grades_audit_log_trigger ON public.grades;
CREATE TRIGGER grades_audit_log_trigger
  AFTER INSERT OR UPDATE ON public.grades
  FOR EACH ROW
  EXECUTE FUNCTION public.log_grade_change();
