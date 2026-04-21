import {
  buildModerationActionPlan,
  buildModerationAuditPayload,
  buildModerationCasePayload,
  getModerationQueueStats,
  type ModerationCaseView,
} from "@/lib/moderationWorkflow";

describe("moderation workflow service", () => {
  it("builds a moderation case payload from moderation signals and an existing case", () => {
    const payload = buildModerationCasePayload({
      submissionId: "submission-1",
      assignmentId: "assignment-1",
      gradeId: "grade-1",
      lecturerId: "lecturer-1",
      firstMarkerId: "marker-1",
      status: "moderation_pending",
      aiScoreSnapshot: 68,
      firstMarkerScore: 72,
      triggerFlags: ["boundary_score", "low_confidence"],
      triggerSummary: "Boundary score with low confidence.",
      confidenceScore: 0.62,
      integrityRiskScore: 58,
      existingCase: {
        id: "case-1",
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "lecturer-1",
        first_marker_id: "marker-1",
        moderator_id: "moderator-1",
        status: "moderation_in_progress",
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: null,
        integrity_risk_score: null,
        ai_score_snapshot: 68,
        first_marker_score: 72,
        moderator_score: 70,
        final_agreed_score: 70,
        final_agreed_feedback: "Existing feedback",
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
    });

    expect(payload.moderator_id).toBe("moderator-1");
    expect(payload.trigger_flags).toEqual(["boundary_score", "low_confidence"]);
    expect(payload.final_agreed_score).toBe(70);
    expect(payload.final_agreed_feedback).toBe("Existing feedback");
  });

  it("builds an audit payload with stable defaults", () => {
    const payload = buildModerationAuditPayload({
      submissionId: "submission-1",
      gradeId: "grade-1",
      moderationCaseId: "case-1",
      changedBy: "lecturer-1",
      eventType: "grade_approved",
      actorRole: "lecturer",
      previousValues: { status: "first_review" },
      newValues: { status: "approved" },
      reason: "Approved after moderation.",
    });

    expect(payload).toMatchObject({
      submission_id: "submission-1",
      grade_id: "grade-1",
      moderation_case_id: "case-1",
      changed_by: "lecturer-1",
      event_type: "grade_approved",
      actor_role: "lecturer",
      previous_values: { status: "first_review" },
      new_values: { status: "approved" },
      reason: "Approved after moderation.",
    });
  });

  it("derives moderation action transitions for moderator agreement", () => {
    const plan = buildModerationActionPlan({
      action: "agree",
      moderationCase: {
        id: "case-1",
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "lecturer-1",
        first_marker_id: "marker-1",
        moderator_id: null,
        status: "moderation_in_progress",
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: 0.64,
        integrity_risk_score: 61,
        ai_score_snapshot: 68,
        first_marker_score: 72,
        moderator_score: null,
        final_agreed_score: null,
        final_agreed_feedback: null,
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      submissionStatus: "moderation_in_progress",
      grade: {
        ai_score: 68,
        ai_feedback: "AI feedback",
        lecturer_score: 72,
        lecturer_feedback: "Lecturer feedback",
        final_score: null,
        final_feedback: null,
      },
      userId: "moderator-1",
      noteDraft: "Moderator agrees after comparison.",
      scoreDraft: "72",
      feedbackDraft: "Confirmed lecturer feedback.",
    });

    expect(plan.nextCasePatch.status).toBe("moderated");
    expect(plan.nextCasePatch.moderator_id).toBe("moderator-1");
    expect(plan.nextSubmissionStatus).toBe("moderated");
    expect(plan.reviewPayload).toMatchObject({
      reviewer_role: "moderator",
      action: "agree",
      proposed_score: 72,
      proposed_feedback: "Confirmed lecturer feedback.",
      notes: "Moderator agrees after comparison.",
    });
  });

  it("counts moderation queue states correctly", () => {
    const makeCase = (id: string, status: ModerationCaseView["moderationCase"]["status"]): ModerationCaseView => ({
      moderationCase: {
        id,
        submission_id: `${id}-submission`,
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "lecturer-1",
        first_marker_id: "marker-1",
        moderator_id: null,
        status,
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: null,
        integrity_risk_score: null,
        ai_score_snapshot: null,
        first_marker_score: null,
        moderator_score: null,
        final_agreed_score: null,
        final_agreed_feedback: null,
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      submission: {
        id: `${id}-submission`,
        assignment_id: "assignment-1",
        student_id: "student-1",
        file_name: "essay.pdf",
        file_url: "file-url",
        submitted_at: "2026-04-21T10:00:00.000Z",
        status,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      } as never,
      grade: null,
      assignment: null,
      firstMarker: null,
      moderator: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    });

    const stats = getModerationQueueStats([
      makeCase("case-1", "moderation_pending"),
      makeCase("case-2", "moderation_in_progress"),
      makeCase("case-3", "moderated"),
      makeCase("case-4", "escalated"),
    ]);

    expect(stats).toEqual({
      pending: 1,
      inProgress: 1,
      moderated: 1,
      escalated: 1,
    });
  });
});
