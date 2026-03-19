
-- Create assignment status enum
CREATE TYPE public.assignment_status AS ENUM ('draft', 'published', 'closed');

-- Create submission status enum
CREATE TYPE public.submission_status AS ENUM ('submitted', 'ai_grading', 'ai_graded', 'under_review', 'approved', 'released');

-- Assignments table (created by lecturers)
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lecturer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  module_code TEXT,
  rubric JSONB DEFAULT '[]'::jsonb,
  max_score NUMERIC NOT NULL DEFAULT 100,
  due_date TIMESTAMP WITH TIME ZONE,
  status assignment_status NOT NULL DEFAULT 'draft',
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Submissions table (student submissions or bulk uploaded)
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name TEXT,
  student_email TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  status submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Grades table (AI-generated, lecturer-reviewed)
CREATE TABLE public.grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  ai_score NUMERIC,
  ai_feedback TEXT,
  ai_breakdown JSONB DEFAULT '{}'::jsonb,
  lecturer_score NUMERIC,
  lecturer_feedback TEXT,
  final_score NUMERIC,
  final_feedback TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Assignments RLS
CREATE POLICY "Lecturers can manage own assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (lecturer_id = auth.uid())
  WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Students can view published assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (status = 'published' AND is_student());

-- Submissions RLS
CREATE POLICY "Students can insert own submissions" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR uploaded_by = auth.uid());

CREATE POLICY "Students can view own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Lecturers can view submissions for their assignments" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id AND a.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can update submissions for their assignments" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id AND a.lecturer_id = auth.uid()
    )
  );

-- Grades RLS
CREATE POLICY "Students can view own grades" ON public.grades
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Lecturers can manage grades for their assignments" ON public.grades
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id AND a.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_id AND a.lecturer_id = auth.uid()
    )
  );

-- Create storage bucket for submissions
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Users can view own submissions" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Lecturers can view all submissions" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND is_lecturer());
