import {
  canReleaseStatus,
  getApprovalBlockReason,
  getAssessmentSummary,
  getSelectedWorkflowActionState,
  getSubmissionDisplayState,
  isApprovableWorkflowStatus,
  isRegradableWorkflowStatus,
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

  it("keeps regrade and approval eligibility in shared workflow helpers", () => {
    expect(isRegradableWorkflowStatus("submitted")).toBe(true);
    expect(isRegradableWorkflowStatus("approved")).toBe(true);
    expect(isRegradableWorkflowStatus("released")).toBe(false);

    expect(isApprovableWorkflowStatus("ai_graded")).toBe(false);
    expect(isApprovableWorkflowStatus("first_review")).toBe(true);
    expect(isApprovableWorkflowStatus("moderated")).toBe(true);
    expect(isApprovableWorkflowStatus("approved")).toBe(false);
  });

  it("summarizes selected workflow actions consistently for the assignment page", () => {
    expect(
      getSelectedWorkflowActionState([
        "submitted",
        "ai_graded",
        "under_review",
        "approved",
        "released",
      ]),
    ).toEqual({
      submittedCount: 1,
      regradableCount: 4,
      approvableCount: 1,
      releaseReadyCount: 1,
      hasRegradable: true,
      hasApprovable: true,
      hasReleaseReady: true,
    });
  });

  it("builds a lecturer review display state for unreleased graded work", () => {
    expect(
      getSubmissionDisplayState({
        status: "ai_graded",
        grade: {
          ai_score: 58,
          ai_feedback: "AI feedback",
        },
        isLecturer: true,
      }),
    ).toEqual({
      scoreToDisplay: 58,
      studentVisibleFeedback: null,
      showFeedbackSummary: true,
      showFirstReview: true,
      showApprove: false,
      showRelease: false,
      showReleaseNote: false,
    });
  });

  it("shows approval without first-review editing once work has moved into moderation-complete state", () => {
    expect(
      getSubmissionDisplayState({
        status: "moderated",
        grade: {
          ai_score: 58,
          ai_feedback: "AI feedback",
        },
        isLecturer: true,
      }),
    ).toEqual({
      scoreToDisplay: 58,
      studentVisibleFeedback: null,
      showFeedbackSummary: true,
      showFirstReview: false,
      showApprove: true,
      showRelease: false,
      showReleaseNote: false,
    });
  });

  it("builds a student-visible released display state from resolved final values", () => {
    expect(
      getSubmissionDisplayState({
        status: "released",
        grade: {
          ai_score: 58,
          lecturer_score: 61,
          final_score: 63,
          final_feedback: "Released feedback",
        },
        isLecturer: false,
      }),
    ).toEqual({
      scoreToDisplay: 63,
      studentVisibleFeedback: "Released feedback",
      showFeedbackSummary: false,
      showFirstReview: false,
      showApprove: false,
      showRelease: false,
      showReleaseNote: false,
    });
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
