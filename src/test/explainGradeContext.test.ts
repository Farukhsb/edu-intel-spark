// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildReleasedGradeContext } from "../../supabase/functions/_shared/explain-grade-context";

const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });

const releasedRows = {
  submission: {
    id: "6f951f5c-2665-48c8-b404-3ef9b6288882",
    assignment_id: "985386a6-9981-48eb-8277-568b0ec4957f",
    student_id: "student-1",
    file_name: "essay.pdf",
    status: "released",
  },
  grade: {
    id: "grade-1",
    submission_id: "6f951f5c-2665-48c8-b404-3ef9b6288882",
    final_score: 74,
    ai_feedback: "Released feedback",
    ai_breakdown: [{ criterion: "Argument", score: 18, max_score: 25 }],
    grading_confidence: 0.82,
  },
  assignment: {
    id: "985386a6-9981-48eb-8277-568b0ec4957f",
    module_code: "ENG101",
    title: "Critical Essay",
    max_score: 100,
  },
};

describe("released explain-grade context", () => {
  it("allows a student to explain their own released grade", () => {
    const context = buildReleasedGradeContext(releasedRows, "student-1", makeError);

    expect(context).toMatchObject({
      submissionId: releasedRows.submission.id,
      gradeId: "grade-1",
      assessment: "ENG101 Critical Essay",
      status: "released",
      totalGrade: 74,
      feedback: "Released feedback",
    });
  });

  it("rejects unreleased grades without exposing AI feedback", () => {
    expect(() =>
      buildReleasedGradeContext(
        {
          ...releasedRows,
          submission: { ...releasedRows.submission, status: "approved" },
          grade: { ...releasedRows.grade, ai_feedback: "Unreleased private AI feedback" },
        },
        "student-1",
        makeError,
      ),
    ).toThrow(/Grade is not released/);

    try {
      buildReleasedGradeContext(
        {
          ...releasedRows,
          submission: { ...releasedRows.submission, status: "approved" },
          grade: { ...releasedRows.grade, ai_feedback: "Unreleased private AI feedback" },
        },
        "student-1",
        makeError,
      );
    } catch (error) {
      expect((error as Error).message).not.toMatch(/private AI feedback/i);
      expect((error as Error & { status: number }).status).toBe(403);
    }
  });

  it("rejects another student's grade", () => {
    try {
      buildReleasedGradeContext(releasedRows, "student-2", makeError);
      throw new Error("Expected access check to fail");
    } catch (error) {
      expect((error as Error).message).toBe("Forbidden");
      expect((error as Error & { status: number }).status).toBe(403);
    }
  });

  it("uses server-side grade rows instead of fake browser gradeContext", () => {
    const fakeBrowserGradeContext = {
      totalGrade: 100,
      feedback: "Fake browser feedback",
      breakdown: [{ criterion: "Fake", score: 100, max_score: 100 }],
    };
    const context = buildReleasedGradeContext(releasedRows, "student-1", makeError);

    expect(context.totalGrade).toBe(74);
    expect(context.feedback).toBe("Released feedback");
    expect(JSON.stringify(context)).not.toContain(fakeBrowserGradeContext.feedback);
  });
});
