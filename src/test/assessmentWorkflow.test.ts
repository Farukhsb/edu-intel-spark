import {
  canReleaseStatus,
  getApprovalBlockReason,
  getAssessmentSummary,
  isStudentGradeVisible,
  resolveFinalGradeValues,
} from "@/lib/assessmentWorkflow";

describe("assessment workflow rules", () => {
  it("summarizes submission counts consistently across workflow states", () => {
    const summary = getAssessmentSummary([
      { status: "submitted" },
      { status: "ai_graded" },
      { status: "moderation_pending" },
      { status: "approved" },
      { status: "released" },
    ]);

    expect(summary).toEqual({
      submittedCount: 5,
      gradedCount: 4,
      releasedCount: 1,
      pendingCount: 3,
    });
  });

  it("keeps student visibility restricted to released grades", () => {
    expect(isStudentGradeVisible("approved")).toBe(false);
    expect(isStudentGradeVisible("released")).toBe(true);
  });

  it("only allows release from approved state", () => {
    expect(canReleaseStatus("approved")).toBe(true);
    expect(canReleaseStatus("released")).toBe(false);
    expect(canReleaseStatus("moderated")).toBe(false);
  });

  it("blocks approval while moderation is active or still required", () => {
    expect(
      getApprovalBlockReason({ status: "moderation_pending", needsModeration: true }),
    ).toBe("moderation_in_progress");
    expect(
      getApprovalBlockReason({ status: "first_review", needsModeration: true }),
    ).toBe("moderation_required");
    expect(
      getApprovalBlockReason({ status: "moderated", needsModeration: true }),
    ).toBeNull();
  });

  it("resolves final grade values with moderation outcome taking precedence", () => {
    const resolved = resolveFinalGradeValues({
      grade: {
        ai_score: 58,
        lecturer_score: 61,
        final_score: 63,
        ai_feedback: "AI feedback",
        lecturer_feedback: "Lecturer feedback",
        final_feedback: "Final feedback",
      },
      moderationCase: {
        final_agreed_score: 66,
        final_agreed_feedback: "Moderated feedback",
      },
    });

    expect(resolved).toEqual({
      finalScore: 66,
      finalFeedback: "Moderated feedback",
    });
  });
});
