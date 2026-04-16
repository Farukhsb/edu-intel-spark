CREATE TABLE IF NOT EXISTS public.student_writing_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  average_sentence_complexity NUMERIC NOT NULL DEFAULT 0,
  lexile_level NUMERIC NOT NULL DEFAULT 0,
  error_fingerprint JSONB NOT NULL DEFAULT '[]'::jsonb,
  vocabulary_breadth NUMERIC NOT NULL DEFAULT 0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  baseline_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

ALTER TABLE public.student_writing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own writing profile"
ON public.student_writing_profiles
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Lecturers can view writing profiles for own students"
ON public.student_writing_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.student_id = public.student_writing_profiles.student_id
      AND a.lecturer_id = auth.uid()
  )
);

ALTER TABLE public.grades
ADD COLUMN IF NOT EXISTS assignment_type TEXT,
ADD COLUMN IF NOT EXISTS grading_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS grading_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS grades_submission_id_key ON public.grades(submission_id);
