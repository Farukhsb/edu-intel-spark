import { buildGradeImportPreview, summarizeRejectedRows, type GradeImportSourceRow, type SubmissionCandidate } from "../_shared/grade-import.ts";

export function toSubmissionCandidates(submissions: Array<{
  id: string;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  status: string;
  file_name: string;
  file_url: string;
}>): SubmissionCandidate[] {
  return submissions.map((submission) => ({
    id: submission.id,
    student_name: submission.student_name,
    student_email: submission.student_email,
    submitted_at: submission.submitted_at,
    status: submission.status,
    file_name: submission.file_name,
    file_url: submission.file_url,
  }));
}

export function buildImportPreview(params: {
  rows: GradeImportSourceRow[];
  submissions: SubmissionCandidate[];
  assignmentMaxScore: number;
  allowSyntheticSubmissions: boolean;
}) {
  const preview = buildGradeImportPreview({
    rows: params.rows,
    submissions: params.submissions,
    assignmentMaxScore: params.assignmentMaxScore,
    allowSyntheticSubmissions: params.allowSyntheticSubmissions,
  });

  return {
    preview,
    previewResponse: {
      success: true,
      committed: false,
      summary: preview.summary,
      rows: preview.rows,
      rejectedRows: summarizeRejectedRows(preview.rows),
    },
  };
}
