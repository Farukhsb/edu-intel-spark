export type AssignmentForGrading = {
  id: string;
  lecturer_id: string | null;
  institution_id?: string | null;
  title: string;
  description: string | null;
  module_code: string | null;
  max_score: number;
  rubric: unknown;
};

export type SubmissionForGrading = {
  id: string;
  assignment_id?: string;
  institution_id?: string | null;
  student_name: string | null;
  student_email: string | null;
  file_name: string | null;
  file_url: string;
};

export type FetchSubmissionContentForGrading = (
  submission: { file_url: string; file_name: string | null },
) => Promise<{
  extractedText: string;
  extractionMetadata?: Record<string, unknown>;
}>;
