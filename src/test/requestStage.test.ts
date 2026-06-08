import { describe, expect, it } from "vitest";
import {
  buildExistingGradesByFingerprint,
  loadAssignmentForGrading,
  loadAssignmentSubmissionRows,
  loadExistingGradesForGrading,
  loadRequestedSubmissionsForGrading,
  normalizeRubricForAssignment,
} from "../../supabase/functions/grade-submission/request-stage";
import type {
  AssignmentForGrading,
  ExistingGradeRecordWithMeta,
  SubmissionForGrading,
} from "../../supabase/functions/grade-submission/types";

function createQueryClient(dataByTable: Record<string, unknown>, errorByTable: Record<string, unknown> = {}) {
  return {
    from(table: string) {
      const result = {
        data: dataByTable[table] ?? null,
        error: errorByTable[table] ?? null,
      };
      const chain = {
        data: result.data,
        error: result.error,
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        in() {
          return chain;
        },
        maybeSingle: async () => result,
      };

      return chain;
    },
  };
}

describe("grade-submission request stage", () => {
  it("builds a fallback rubric when the assignment has no rubric", () => {
    const assignment: AssignmentForGrading = {
      id: "assignment-1",
      lecturer_id: "lecturer-1",
      title: "Case Study",
      description: "Analyse the submission.",
      module_code: "CS101",
      max_score: 80,
      rubric: null,
    };

    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);

    expect(normalizedRubric).toEqual([
      {
        criterion: "Overall quality",
        weight: 80,
        description: "Holistic quality, correctness, and completeness.",
      },
    ]);
    expect(rubricText).toContain("Overall quality");
  });

  it("normalizes malformed rubric entries defensively", () => {
    const assignment: AssignmentForGrading = {
      id: "assignment-2",
      lecturer_id: "lecturer-1",
      title: "Project Report",
      description: "Analyse the report.",
      module_code: "CS101",
      max_score: 30,
      rubric: [
        { criterion: "", weight: "12" as never, description: "" },
        { criterion: "Reflection", weight: 0, description: null as never },
      ],
    };

    const { normalizedRubric, rubricText } = normalizeRubricForAssignment(assignment);

    expect(normalizedRubric).toEqual([
      { criterion: "Criterion 1", weight: 12, description: "" },
      { criterion: "Reflection", weight: 0, description: "" },
    ]);
    expect(rubricText).toContain("Criterion 1");
    expect(rubricText).toContain("Reflection");
  });

  it("loads assignment and submission rows through the institution filter", async () => {
    const client = createQueryClient({
      assignments: {
        id: "assignment-1",
        lecturer_id: "lecturer-1",
        institution_id: "institution-1",
        title: "Case Study",
        description: "Analyse the submission.",
        module_code: "CS101",
        max_score: 80,
        rubric: null,
      },
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          institution_id: "institution-1",
          student_name: "Student One",
          student_email: "one@example.com",
          file_name: "essay.pdf",
          file_url: "submissions/essay.pdf",
        },
      ],
      grades: [
        {
          id: "grade-1",
          submission_id: "submission-1",
          ai_score: 66,
          ai_feedback: "Good work.",
          ai_breakdown: [],
          grading_confidence: 0.8,
          grading_metadata: {},
          created_at: "2026-06-08T10:00:00.000Z",
        },
      ],
    });

    await expect(loadAssignmentForGrading(client as never, "assignment-1", "institution-1")).resolves.toEqual({
      data: expect.objectContaining({ id: "assignment-1", institution_id: "institution-1" }),
      error: null,
    });

    await expect(loadRequestedSubmissionsForGrading(client as never, "assignment-1", ["submission-1"], "institution-1")).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: "submission-1",
          institution_id: "institution-1",
        }),
      ],
      error: null,
    });

    const assignmentRows = await loadAssignmentSubmissionRows(client as never, "assignment-1", "institution-1");
    expect(assignmentRows.data).toHaveLength(1);
    expect(assignmentRows.assignmentSubmissionIds).toEqual(["submission-1"]);
    expect(assignmentRows.assignmentSubmissionsById.get("submission-1")).toEqual(
      expect.objectContaining({
        file_url: "submissions/essay.pdf",
      }),
    );

    const existingGrades = await loadExistingGradesForGrading(client as never, ["submission-1"], "institution-1");
    expect(existingGrades.error).toBeNull();
    expect(existingGrades.data).toEqual([
      expect.objectContaining({
        id: "grade-1",
        submission_id: "submission-1",
      }),
    ]);
    expect(existingGrades.existingGradesBySubmission.get("submission-1")).toEqual(
      expect.objectContaining({
        id: "grade-1",
      }),
    );
  });

  it("backfills missing fingerprint metadata for historical grades", async () => {
    const assignment: AssignmentForGrading = {
      id: "assignment-1",
      lecturer_id: "lecturer-1",
      title: "Database Normalisation Case Study",
      description: "Redesign the schema.",
      module_code: "CS220",
      max_score: 80,
      rubric: [
        { criterion: "Schema Design", weight: 40, description: "Produce a coherent schema." },
      ],
    };
    const { normalizedRubric } = normalizeRubricForAssignment(assignment);

    const submission: SubmissionForGrading = {
      id: "submission-1",
      assignment_id: assignment.id,
      student_name: "Faruk Student",
      student_email: "faruk@example.com",
      file_name: "normalisation.txt",
      file_url: "submissions/normalisation.txt",
    };

    const existingGradesByFingerprint = await buildExistingGradesByFingerprint({
      assignment,
      existingGradeRows: [
        {
          id: "grade-1",
          submission_id: submission.id,
          ai_score: 62,
          ai_feedback: "Good structure.",
          ai_breakdown: [],
          grading_confidence: 0.74,
          grading_metadata: {},
          created_at: "2026-05-08T10:00:00.000Z",
        },
      ],
      assignmentSubmissionsById: new Map([[submission.id, submission]]),
      normalizedRubric,
      fetchSubmissionContent: async () => ({
        extractedText: "Third normal form removes transitive dependencies and duplicate storage.",
      }),
    });

    expect(existingGradesByFingerprint.size).toBe(1);
    const cluster = Array.from(existingGradesByFingerprint.values())[0];
    expect(cluster.canonicalGrade.grading_metadata?.content_fingerprint).toEqual(
      expect.stringContaining(`${assignment.id}:`),
    );
    expect(cluster.canonicalGrade.grading_metadata?.grading_input_hash).toEqual(expect.any(String));
    expect(cluster.canonicalGrade.grading_metadata?.grading_prompt_version).toBe("2026-05-25-v9");
    expect(cluster.canonicalGrade.grading_metadata?.blind_grading_applied).toBe(true);
  });

  it("skips unreadable historical submissions while preserving clustered fingerprints", async () => {
    const assignment: AssignmentForGrading = {
      id: "assignment-2",
      lecturer_id: "lecturer-1",
      title: "Research Essay",
      description: "Evaluate the literature with evidence.",
      module_code: "CS330",
      max_score: 100,
      rubric: [
        { criterion: "Analysis", weight: 50, description: "Evaluate the literature." },
      ],
    };
    const { normalizedRubric } = normalizeRubricForAssignment(assignment);
    const submissionWithFile: SubmissionForGrading = {
      id: "submission-2",
      assignment_id: assignment.id,
      student_name: "Student Two",
      student_email: "two@example.com",
      file_name: "essay.txt",
      file_url: "submissions/essay.txt",
    };
    const missingFileSubmission: SubmissionForGrading = {
      id: "submission-3",
      assignment_id: assignment.id,
      student_name: "Student Three",
      student_email: "three@example.com",
      file_name: "essay.txt",
      file_url: null,
    };
    const fingerprintedGrade: ExistingGradeRecordWithMeta = {
      id: "grade-2",
      submission_id: "submission-1",
      ai_score: 74,
      ai_feedback: "Strong essay.",
      ai_breakdown: [],
      grading_confidence: 0.8,
      grading_metadata: {
        content_fingerprint: "assignment-2:fingerprint",
        grading_input_hash: "hash-1",
        grading_prompt_version: "2026-05-25-v9",
      },
      created_at: "2026-06-08T10:00:00.000Z",
    };

    const clusters = await buildExistingGradesByFingerprint({
      assignment,
      existingGradeRows: [
        fingerprintedGrade,
        {
          id: "grade-3",
          submission_id: submissionWithFile.id,
          ai_score: 61,
          ai_feedback: "Needs more evidence.",
          ai_breakdown: [],
          grading_confidence: 0.55,
          grading_metadata: {},
          created_at: "2026-06-08T10:00:00.000Z",
        },
        {
          id: "grade-4",
          submission_id: missingFileSubmission.id,
          ai_score: 58,
          ai_feedback: "Incomplete.",
          ai_breakdown: [],
          grading_confidence: 0.52,
          grading_metadata: {},
          created_at: "2026-06-08T10:00:00.000Z",
        },
      ],
      assignmentSubmissionsById: new Map([
        [submissionWithFile.id, submissionWithFile],
        [missingFileSubmission.id, missingFileSubmission],
      ]),
      normalizedRubric,
      fetchSubmissionContent: async ({ file_url }) => {
        if (file_url === submissionWithFile.file_url) {
          throw new Error("Unreadable historical submission");
        }
        return {
          extractedText: "Fallback text.",
        };
      },
    });

    expect(clusters.size).toBe(1);
    expect(Array.from(clusters.values())[0].canonicalGrade.submission_id).toBe("submission-1");
  });
});
