import { describe, expect, it } from "vitest";
import {
  buildGradeImportPreview,
  buildImportedGradePayload,
  normalizeImportedScore,
  parseGradeImportCsv,
  summarizeRejectedRows,
} from "../../supabase/functions/_shared/grade-import";

describe("hybrid grade import", () => {
  it("parses CSV grade rows and normalizes scores to the assignment max", () => {
    const rows = parseGradeImportCsv(
      `student_name,student_email,score,max_score,notes\n"Jane Doe",jane@example.edu,18,20,"Strong analysis"\nJohn Smith,john@example.edu,72,100,Good`,
      100,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      studentName: "Jane Doe",
      studentEmail: "jane@example.edu",
      score: 18,
      maxScore: 20,
      notes: "Strong analysis",
    });
    expect(normalizeImportedScore(18, 20, 100)).toBe(90);
  });

  it("builds a preview that accepts matched rows and creates synthetic submissions for unmatched rows", () => {
    const rows = parseGradeImportCsv(
      `student_name,student_email,score,max_score,notes\nJane Doe,jane@example.edu,18,20,Strong analysis\nUnmatched Student,unmatched@example.edu,72,100,Needs review`,
      100,
    );
    const preview = buildGradeImportPreview({
      rows,
      submissions: [
        {
          id: "submission-1",
          student_name: "Jane Doe",
          student_email: "jane@example.edu",
          submitted_at: "2026-06-01T12:00:00.000Z",
        },
      ],
      assignmentMaxScore: 100,
    });

    expect(preview.summary.rowsProcessed).toBe(2);
    expect(preview.summary.rowsAccepted).toBe(2);
    expect(preview.summary.matchedExistingSubmissions).toBe(1);
    expect(preview.summary.createdSyntheticSubmissions).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      accepted: true,
      submissionAction: "match",
      matchedSubmissionId: "submission-1",
      normalizedScore: 90,
    });
    expect(preview.rows[1]).toMatchObject({
      accepted: true,
      submissionAction: "create",
      matchedSubmissionId: null,
      normalizedScore: 72,
    });
  });

  it("can be configured to reject unmatched rows instead of creating synthetic submissions", () => {
    const rows = parseGradeImportCsv(
      `student_name,student_email,score,max_score\nUnmatched Student,unmatched@example.edu,72,100`,
      100,
    );
    const preview = buildGradeImportPreview({
      rows,
      submissions: [],
      assignmentMaxScore: 100,
      allowSyntheticSubmissions: false,
    });

    expect(preview.summary.rowsRejected).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      accepted: false,
      submissionAction: "create",
      matchedSubmissionId: null,
    });
    expect(preview.rows[0].issues.map((issue) => issue.code)).toContain("missing_submission_match");
  });

  it("marks invalid rows as rejected with readable issues", () => {
    const rows = parseGradeImportCsv(
      `student_name,student_email,score,max_score\nBad Row,bad@example.edu,not-a-score,100`,
      100,
    );
    const preview = buildGradeImportPreview({
      rows,
      submissions: [],
      assignmentMaxScore: 100,
    });

    expect(preview.summary.rowsRejected).toBe(1);
    expect(preview.rows[0].accepted).toBe(false);
    expect(summarizeRejectedRows(preview.rows)).toEqual([
      {
        rowNumber: 2,
        studentName: "Bad Row",
        studentEmail: "bad@example.edu",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "invalid_score", severity: "error" }),
        ]),
      },
    ]);
  });

  it("builds lecturer-uploaded grade payloads without losing prior AI evidence", () => {
    const rows = parseGradeImportCsv(
      `student_name,student_email,score,max_score,notes\nJane Doe,jane@example.edu,18,20,Strong analysis`,
      100,
    );
    const preview = buildGradeImportPreview({
      rows,
      submissions: [
        {
          id: "submission-1",
          student_name: "Jane Doe",
          student_email: "jane@example.edu",
          submitted_at: "2026-06-01T12:00:00.000Z",
        },
      ],
      assignmentMaxScore: 100,
    });

    const payload = buildImportedGradePayload({
      importId: "import-1",
      row: preview.rows[0],
      submissionId: "submission-1",
      lecturerId: "lecturer-1",
      sourceFileName: "grades.csv",
      sourceFileHash: "abc123",
      importMethod: "csv",
      existingGrade: {
        ai_score: 68,
        ai_feedback: "Existing AI grade",
        ai_breakdown: [],
        grading_confidence: 0.81,
        grading_metadata: { existing: true },
        grade_source: "ai_graded",
        source_metadata: { source: "ai" },
      },
    });

    expect(payload.grade_source).toBe("lecturer_uploaded");
    expect(payload.final_score).toBe(90);
    expect(payload.lecturer_score).toBe(90);
    expect(payload.ai_score).toBe(68);
    expect(payload.grading_metadata).toMatchObject({
      existing: true,
      import_id: "import-1",
      import_method: "csv",
      source: "lecturer_uploaded",
    });
    expect(payload.source_metadata).toMatchObject({
      import_id: "import-1",
      import_method: "csv",
      source_file_name: "grades.csv",
      source_file_hash: "abc123",
    });
  });
});
