export type AssignmentOption = {
  id: string;
  title: string;
  module_code?: string | null;
  max_score: number;
  due_date?: string | null;
  status?: string;
};

export type GradeImportIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type GradeImportPreviewRow = {
  rowNumber: number;
  studentName: string;
  studentEmail: string | null;
  score: number;
  maxScore: number;
  submissionDate: string | null;
  notes: string | null;
  rubricBreakdown: Array<Record<string, unknown>>;
  normalizedScore: number;
  matchedSubmissionId: string | null;
  submissionAction: "match" | "create";
  accepted: boolean;
  issues: GradeImportIssue[];
};

export type GradeImportPreviewSummary = {
  rowsProcessed: number;
  rowsAccepted: number;
  rowsRejected: number;
  matchedExistingSubmissions: number;
  createdSyntheticSubmissions: number;
  rowsWithWarnings: number;
};

export type GradeImportResponse = {
  success: boolean;
  committed: boolean;
  assignmentId: string;
  importMethod: "csv" | "image";
  summary: GradeImportPreviewSummary;
  rows: GradeImportPreviewRow[];
  rejectedRows: Array<{
    rowNumber: number;
    studentName: string;
    studentEmail: string | null;
    issues: GradeImportIssue[];
  }>;
  importId?: string;
};

export type DraftState = {
  csvText: string;
  csvFileName: string;
  imageFiles: File[];
};

export type ImportScope = "existing_assignment" | "new_assignment";

export type NewAssignmentDraft = {
  title: string;
  moduleCode: string;
  maxScore: string;
  dueDate: string;
  description: string;
};
