import { describe, expect, it } from "vitest";
import {
  buildExistingGradesByFingerprint,
  normalizeRubricForAssignment,
} from "../../supabase/functions/grade-submission/request-stage";
import type {
  AssignmentForGrading,
  SubmissionForGrading,
} from "../../supabase/functions/grade-submission/types";

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
    expect(cluster.canonicalGrade.grading_metadata?.grading_prompt_version).toBe("2026-04-24-v4");
    expect(cluster.canonicalGrade.grading_metadata?.blind_grading_applied).toBe(true);
  });
});
