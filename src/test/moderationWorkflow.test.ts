import {
  buildModerationActionPlan,
  buildModerationAuditPayload,
  buildModerationCasePayload,
  canBulkApproveModeration,
  canBulkAssignModerator,
  canPerformModerationAction,
  getModerationDisagreementSummary,
  getModerationEscalationSummary,
  getModerationNextStep,
  getModerationOwnerAssignmentSummaries,
  getModerationReleaseState,
  getModerationQueueStats,
  matchesModerationQueueSearch,
  matchesModerationQueueFilter,
  sortModerationQueueCases,
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

  it("enforces moderation action permissions by role and case state", () => {
    const moderationCase = {
      id: "case-1",
      submission_id: "submission-1",
      assignment_id: "assignment-1",
      grade_id: "grade-1",
      lecturer_id: "owner-1",
      first_marker_id: "marker-1",
      moderator_id: "moderator-1",
      status: "moderation_in_progress",
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
    };

    expect(
      canPerformModerationAction({
        action: "agree",
        moderationCase,
        userId: "moderator-1",
      }),
    ).toBe(true);
    expect(
      canPerformModerationAction({
        action: "agree",
        moderationCase,
        userId: "owner-1",
      }),
    ).toBe(false);
    expect(
      canPerformModerationAction({
        action: "approve",
        moderationCase,
        userId: "owner-1",
      }),
    ).toBe(false);
    expect(
      canPerformModerationAction({
        action: "approve",
        moderationCase: { ...moderationCase, status: "moderated" },
        userId: "owner-1",
      }),
    ).toBe(true);
  });

  it("summarizes whether the moderator confirmed or changed the outcome", () => {
    const baseCase = {
      id: "case-1",
      submission_id: "submission-1",
      assignment_id: "assignment-1",
      grade_id: "grade-1",
      lecturer_id: "owner-1",
      first_marker_id: "marker-1",
      moderator_id: "moderator-1",
      status: "moderated",
      trigger_flags: [],
      trigger_summary: null,
      confidence_score: null,
      integrity_risk_score: null,
      ai_score_snapshot: null,
      first_marker_score: 67,
      moderator_score: 67,
      final_agreed_score: 67,
      final_agreed_feedback: "Lecturer feedback",
      moderated_at: null,
      approved_at: null,
      created_at: "2026-04-21T10:00:00.000Z",
      updated_at: "2026-04-21T10:00:00.000Z",
    };

    expect(
      getModerationDisagreementSummary({
        moderationCase: baseCase,
        grade: {
          lecturer_score: 67,
          lecturer_feedback: "Lecturer feedback",
        },
        latestModeratorReview: {
          action: "agree",
          proposed_score: 67,
          proposed_feedback: "Lecturer feedback",
        } as never,
      }),
    ).toMatchObject({
      hasMaterialChange: false,
      scoreChanged: false,
      feedbackChanged: false,
      label: "Moderator confirmed the first marker decision.",
    });

    expect(
      getModerationDisagreementSummary({
        moderationCase: {
          ...baseCase,
          moderator_score: 62,
          final_agreed_score: 62,
          final_agreed_feedback: "Moderator feedback",
        },
        grade: {
          lecturer_score: 67,
          lecturer_feedback: "Lecturer feedback",
        },
        latestModeratorReview: {
          action: "adjust",
          proposed_score: 62,
          proposed_feedback: "Moderator feedback",
        } as never,
      }),
    ).toMatchObject({
      hasMaterialChange: true,
      scoreChanged: true,
      feedbackChanged: true,
      label: "Moderator changed both the score and feedback.",
    });
  });

  it("summarizes escalated cases as unresolved disputes", () => {
    const disagreement = getModerationDisagreementSummary({
      moderationCase: {
        id: "case-1",
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "owner-1",
        first_marker_id: "marker-1",
        moderator_id: "moderator-1",
        status: "escalated",
        trigger_flags: [],
        trigger_summary: "Moderator could not close the disagreement.",
        confidence_score: null,
        integrity_risk_score: null,
        ai_score_snapshot: null,
        first_marker_score: 67,
        moderator_score: 62,
        final_agreed_score: 62,
        final_agreed_feedback: "Moderator feedback",
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      grade: {
        lecturer_score: 67,
        lecturer_feedback: "Lecturer feedback",
      },
      latestModeratorReview: {
        action: "escalate",
        proposed_score: 62,
        proposed_feedback: "Moderator feedback",
      } as never,
    });

    expect(
      getModerationEscalationSummary({
        moderationCase: {
          id: "case-1",
          submission_id: "submission-1",
          assignment_id: "assignment-1",
          grade_id: "grade-1",
          lecturer_id: "owner-1",
          first_marker_id: "marker-1",
          moderator_id: "moderator-1",
          status: "escalated",
          trigger_flags: [],
          trigger_summary: "Moderator could not close the disagreement.",
          confidence_score: null,
          integrity_risk_score: null,
          ai_score_snapshot: null,
          first_marker_score: 67,
          moderator_score: 62,
          final_agreed_score: 62,
          final_agreed_feedback: "Moderator feedback",
          moderated_at: null,
          approved_at: null,
          created_at: "2026-04-21T10:00:00.000Z",
          updated_at: "2026-04-21T10:00:00.000Z",
        },
        disagreement,
        latestModeratorReview: {
          notes: "Moderator could not close the disagreement.",
        } as never,
      }),
    ).toMatchObject({
      headline: "Escalated after the moderator changed the outcome.",
      resolutionState: "This case is still unresolved and needs owner or senior review before final approval.",
      escalationReason: "Moderator could not close the disagreement.",
    });
  });

  it("summarizes release control states for moderated workflow outcomes", () => {
    expect(
      getModerationReleaseState({
        moderationCase: {
          id: "case-1",
          submission_id: "submission-1",
          assignment_id: "assignment-1",
          grade_id: "grade-1",
          lecturer_id: "owner-1",
          first_marker_id: "marker-1",
          moderator_id: "moderator-1",
          status: "moderated",
          trigger_flags: [],
          trigger_summary: null,
          confidence_score: null,
          integrity_risk_score: null,
          ai_score_snapshot: null,
          first_marker_score: 67,
          moderator_score: 67,
          final_agreed_score: 67,
          final_agreed_feedback: "Feedback",
          moderated_at: null,
          approved_at: null,
          created_at: "2026-04-21T10:00:00.000Z",
          updated_at: "2026-04-21T10:00:00.000Z",
        },
        submissionStatus: "moderated",
      }),
    ).toMatchObject({
      tone: "approval",
      badge: "Owner approval required",
    });

    expect(
      getModerationReleaseState({
        moderationCase: {
          id: "case-2",
          submission_id: "submission-2",
          assignment_id: "assignment-1",
          grade_id: "grade-1",
          lecturer_id: "owner-1",
          first_marker_id: "marker-1",
          moderator_id: "moderator-1",
          status: "escalated",
          trigger_flags: [],
          trigger_summary: null,
          confidence_score: null,
          integrity_risk_score: null,
          ai_score_snapshot: null,
          first_marker_score: 67,
          moderator_score: 62,
          final_agreed_score: 62,
          final_agreed_feedback: "Feedback",
          moderated_at: null,
          approved_at: null,
          created_at: "2026-04-21T10:00:00.000Z",
          updated_at: "2026-04-21T10:00:00.000Z",
        },
        submissionStatus: "escalated",
      }),
    ).toMatchObject({
      tone: "blocked",
      badge: "Release blocked",
    });

    expect(
      getModerationReleaseState({
        moderationCase: {
          id: "case-3",
          submission_id: "submission-3",
          assignment_id: "assignment-1",
          grade_id: "grade-1",
          lecturer_id: "owner-1",
          first_marker_id: "marker-1",
          moderator_id: "moderator-1",
          status: "moderated",
          trigger_flags: [],
          trigger_summary: null,
          confidence_score: null,
          integrity_risk_score: null,
          ai_score_snapshot: null,
          first_marker_score: 67,
          moderator_score: 67,
          final_agreed_score: 67,
          final_agreed_feedback: "Feedback",
          moderated_at: null,
          approved_at: "2026-04-22T10:00:00.000Z",
          created_at: "2026-04-21T10:00:00.000Z",
          updated_at: "2026-04-21T10:00:00.000Z",
        },
        submissionStatus: "approved",
      }),
    ).toMatchObject({
      tone: "ready",
      badge: "Ready for release",
    });
  });

  it("summarizes the next operational moderation step for key states", () => {
    const pendingUnassigned = {
      moderationCase: {
        id: "case-pending",
        submission_id: "submission-pending",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "owner-1",
        first_marker_id: "marker-1",
        moderator_id: null,
        status: "moderation_pending",
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: null,
        integrity_risk_score: null,
        ai_score_snapshot: null,
        first_marker_score: 68,
        moderator_score: null,
        final_agreed_score: null,
        final_agreed_feedback: null,
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      submission: { status: "moderation_pending" } as never,
      grade: null,
      assignment: null,
      firstMarker: null,
      moderator: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    } satisfies ModerationCaseView;

    const inProgressAssigned = {
      ...pendingUnassigned,
      moderationCase: {
        ...pendingUnassigned.moderationCase,
        id: "case-progress",
        moderator_id: "moderator-1",
        status: "moderation_in_progress",
      },
      submission: { status: "moderation_in_progress" } as never,
    } satisfies ModerationCaseView;

    const moderatedAwaitingApproval = {
      ...inProgressAssigned,
      moderationCase: {
        ...inProgressAssigned.moderationCase,
        id: "case-approved-waiting",
        status: "moderated",
        moderator_score: 66,
        final_agreed_score: 66,
        final_agreed_feedback: "Feedback",
      },
      submission: { status: "moderated" } as never,
    } satisfies ModerationCaseView;

    const approvedReady = {
      ...moderatedAwaitingApproval,
      moderationCase: {
        ...moderatedAwaitingApproval.moderationCase,
        id: "case-ready",
        approved_at: "2026-04-22T10:00:00.000Z",
      },
      submission: { status: "approved" } as never,
    } satisfies ModerationCaseView;

    const escalated = {
      ...moderatedAwaitingApproval,
      moderationCase: {
        ...moderatedAwaitingApproval.moderationCase,
        id: "case-escalated",
        status: "escalated",
      },
      submission: { status: "escalated" } as never,
    } satisfies ModerationCaseView;

    expect(getModerationNextStep({ item: pendingUnassigned, userId: "owner-1" })).toMatchObject({
      headline: "Assign a moderator",
      actor: "owner",
      tone: "warning",
    });
    expect(getModerationNextStep({ item: inProgressAssigned, userId: "moderator-1" })).toMatchObject({
      headline: "Complete the moderation decision",
      actor: "moderator",
      tone: "progress",
    });
    expect(getModerationNextStep({ item: moderatedAwaitingApproval, userId: "owner-1" })).toMatchObject({
      headline: "Assignment owner approval required",
      actor: "owner",
      tone: "warning",
    });
    expect(getModerationNextStep({ item: approvedReady, userId: "owner-1" })).toMatchObject({
      headline: "Release the approved outcome",
      actor: "owner",
      tone: "ready",
    });
    expect(getModerationNextStep({ item: escalated, userId: "owner-1" })).toMatchObject({
      headline: "Escalated dispute needs owner or senior review",
      actor: "senior_review",
      tone: "blocked",
    });
  });

  it("matches triage filters for assigned, approval, escalated, and release-ready cases", () => {
    const assignedItem = {
      moderationCase: {
        id: "case-assigned",
        submission_id: "submission-assigned",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "owner-1",
        first_marker_id: "marker-1",
        moderator_id: "moderator-1",
        status: "moderation_in_progress",
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
      submission: { status: "moderation_in_progress" } as never,
      grade: null,
      assignment: null,
      firstMarker: null,
      moderator: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    } satisfies ModerationCaseView;

    const approvalItem = {
      ...assignedItem,
      moderationCase: {
        ...assignedItem.moderationCase,
        id: "case-approval",
        moderator_id: "moderator-2",
        status: "moderated",
      },
      submission: { status: "moderated" } as never,
    } satisfies ModerationCaseView;

    const escalatedItem = {
      ...assignedItem,
      moderationCase: {
        ...assignedItem.moderationCase,
        id: "case-escalated",
        status: "escalated",
      },
      submission: { status: "escalated" } as never,
    } satisfies ModerationCaseView;

    const readyItem = {
      ...assignedItem,
      moderationCase: {
        ...assignedItem.moderationCase,
        id: "case-ready",
        status: "moderated",
        approved_at: "2026-04-22T10:00:00.000Z",
      },
      submission: { status: "approved" } as never,
    } satisfies ModerationCaseView;

    expect(
      matchesModerationQueueFilter({
        item: assignedItem,
        filter: "assigned_to_me",
        userId: "moderator-1",
      }),
    ).toBe(true);
    expect(
      matchesModerationQueueFilter({
        item: approvalItem,
        filter: "awaiting_my_approval",
        userId: "owner-1",
      }),
    ).toBe(true);
    expect(
      matchesModerationQueueFilter({
        item: escalatedItem,
        filter: "escalated",
        userId: "owner-1",
      }),
    ).toBe(true);
    expect(
      matchesModerationQueueFilter({
        item: readyItem,
        filter: "ready_for_release",
        userId: "owner-1",
      }),
    ).toBe(true);
  });

  it("matches queue search terms and sorts by priority", () => {
    const escalatedItem = {
      moderationCase: {
        id: "case-escalated",
        submission_id: "submission-escalated",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "owner-1",
        first_marker_id: "marker-1",
        moderator_id: "moderator-1",
        status: "escalated",
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: null,
        integrity_risk_score: null,
        ai_score_snapshot: null,
        first_marker_score: 67,
        moderator_score: 62,
        final_agreed_score: 62,
        final_agreed_feedback: "Feedback",
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-23T10:00:00.000Z",
      },
      submission: {
        id: "submission-escalated",
        assignment_id: "assignment-1",
        student_id: "student-1",
        student_name: "Zara Escalated",
        student_email: "zara@test.edu",
        file_name: "essay.pdf",
        file_type: "application/pdf",
        file_url: "student-1/assignment-1/essay.pdf",
        status: "escalated",
        submitted_at: "2026-04-21T10:00:00.000Z",
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
        uploaded_by: "student-1",
      } as unknown as ModerationCaseView["submission"],
      assignment: {
        id: "assignment-1",
        title: "Research Methods",
        description: null,
        module_code: null,
        lecturer_id: "owner-1",
        due_date: null,
        status: "published",
        max_score: 100,
        rubric: [],
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
        file_url: null,
      } as unknown as ModerationCaseView["assignment"],
      firstMarker: {
        id: "marker-1",
        full_name: "Dr. First Marker",
        email: "marker@example.edu",
        role: "lecturer",
        avatar_url: null,
        cohort_id: null,
        department_name: "Computer Science",
        department_id: null,
        must_change_password: false,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      moderator: {
        id: "moderator-1",
        full_name: "Morgan Moderator",
        email: "moderator@example.edu",
        role: "lecturer",
        avatar_url: null,
        cohort_id: null,
        department_name: "Computer Science",
        department_id: null,
        must_change_password: false,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      grade: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    } satisfies ModerationCaseView;

    const approvalItem = {
      moderationCase: {
        ...escalatedItem.moderationCase,
        id: "case-approval",
        status: "moderated",
        updated_at: "2026-04-22T10:00:00.000Z",
      },
      submission: {
        id: "submission-escalated",
        assignment_id: "assignment-1",
        student_id: "student-1",
        student_name: "Amaka Approval",
        student_email: "amaka@test.edu",
        file_name: "essay.pdf",
        file_type: "application/pdf",
        file_url: "student-1/assignment-1/essay.pdf",
        status: "moderated",
        submitted_at: "2026-04-21T10:00:00.000Z",
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-22T10:00:00.000Z",
        uploaded_by: "student-1",
      } as unknown as ModerationCaseView["submission"],
      assignment: {
        id: "assignment-1",
        title: "Policy Analysis",
        description: null,
        module_code: null,
        lecturer_id: "owner-1",
        due_date: null,
        status: "published",
        max_score: 100,
        rubric: [],
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
        file_url: null,
      } as unknown as ModerationCaseView["assignment"],
      firstMarker: escalatedItem.firstMarker,
      moderator: escalatedItem.moderator,
      grade: escalatedItem.grade,
      integrityReview: escalatedItem.integrityReview,
      reviews: escalatedItem.reviews,
      auditLog: escalatedItem.auditLog,
    } satisfies ModerationCaseView;

    expect(
      matchesModerationQueueSearch({
        item: escalatedItem,
        query: "research methods",
      }),
    ).toBe(true);
    expect(
      matchesModerationQueueSearch({
        item: escalatedItem,
        query: "morgan moderator",
      }),
    ).toBe(true);
    expect(
      matchesModerationQueueSearch({
        item: escalatedItem,
        query: "nonexistent",
      }),
    ).toBe(false);

    expect(sortModerationQueueCases([approvalItem, escalatedItem], "priority").map((item) => item.moderationCase.id)).toEqual([
      "case-escalated",
      "case-approval",
    ]);
    expect(sortModerationQueueCases([escalatedItem, approvalItem], "student").map((item) => item.moderationCase.id)).toEqual([
      "case-approval",
      "case-escalated",
    ]);
  });

  it("allows bulk moderator assignment only for owner-managed pending or in-progress cases", () => {
    const pendingItem = {
      moderationCase: {
        id: "case-pending",
        submission_id: "submission-pending",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "owner-1",
        first_marker_id: "marker-1",
        moderator_id: null,
        status: "moderation_pending",
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
      submission: { id: "submission-pending" } as never,
      grade: null,
      assignment: null,
      firstMarker: null,
      moderator: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    } satisfies ModerationCaseView;

    expect(
      canBulkAssignModerator({
        item: pendingItem,
        userId: "owner-1",
      }),
    ).toBe(true);
    expect(
      canBulkAssignModerator({
        item: { ...pendingItem, moderationCase: { ...pendingItem.moderationCase, status: "moderated" } },
        userId: "owner-1",
      }),
    ).toBe(false);
    expect(
      canBulkAssignModerator({
        item: pendingItem,
        userId: "other-owner",
      }),
    ).toBe(false);
  });

  it("allows bulk owner approval only for moderated owner-managed cases with linked grade data", () => {
    const moderatedItem = {
      moderationCase: {
        id: "case-moderated",
        submission_id: "submission-moderated",
        assignment_id: "assignment-1",
        grade_id: "grade-1",
        lecturer_id: "owner-1",
        first_marker_id: "marker-1",
        moderator_id: "moderator-1",
        status: "moderated",
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: null,
        integrity_risk_score: null,
        ai_score_snapshot: null,
        first_marker_score: 67,
        moderator_score: 66,
        final_agreed_score: 66,
        final_agreed_feedback: "Feedback",
        moderated_at: null,
        approved_at: null,
        created_at: "2026-04-21T10:00:00.000Z",
        updated_at: "2026-04-21T10:00:00.000Z",
      },
      submission: { id: "submission-moderated", status: "moderated" } as never,
      grade: { id: "grade-1" } as never,
      assignment: null,
      firstMarker: null,
      moderator: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    } satisfies ModerationCaseView;

    expect(
      canBulkApproveModeration({
        item: moderatedItem,
        userId: "owner-1",
      }),
    ).toBe(true);
    expect(
      canBulkApproveModeration({
        item: { ...moderatedItem, submission: { id: "submission-moderated", status: "approved" } as never },
        userId: "owner-1",
      }),
    ).toBe(false);
    expect(
      canBulkApproveModeration({
        item: moderatedItem,
        userId: "other-owner",
      }),
    ).toBe(false);
  });

  it("builds owner assignment summaries for release-ready and escalated follow-up", () => {
    const summaries = getModerationOwnerAssignmentSummaries(
      [
        {
          moderationCase: {
            id: "case-ready-alpha",
            submission_id: "submission-ready-alpha",
            assignment_id: "assignment-alpha",
            grade_id: "grade-1",
            lecturer_id: "owner-1",
            first_marker_id: "marker-1",
            moderator_id: "moderator-1",
            status: "moderated",
            trigger_flags: [],
            trigger_summary: null,
            confidence_score: null,
            integrity_risk_score: null,
            ai_score_snapshot: null,
            first_marker_score: 67,
            moderator_score: 67,
            final_agreed_score: 67,
            final_agreed_feedback: "Feedback",
            moderated_at: null,
            approved_at: "2026-04-22T10:00:00.000Z",
            created_at: "2026-04-21T10:00:00.000Z",
            updated_at: "2026-04-21T10:00:00.000Z",
          },
          submission: { id: "submission-ready-alpha", status: "approved" } as never,
          grade: { id: "grade-1" } as never,
          assignment: { id: "assignment-alpha", title: "Assignment Alpha" } as never,
          firstMarker: null,
          moderator: null,
          integrityReview: null,
          reviews: [],
          auditLog: [],
        },
        {
          moderationCase: {
            id: "case-escalated-alpha",
            submission_id: "submission-escalated-alpha",
            assignment_id: "assignment-alpha",
            grade_id: "grade-2",
            lecturer_id: "owner-1",
            first_marker_id: "marker-1",
            moderator_id: "moderator-1",
            status: "escalated",
            trigger_flags: [],
            trigger_summary: null,
            confidence_score: null,
            integrity_risk_score: null,
            ai_score_snapshot: null,
            first_marker_score: 67,
            moderator_score: 62,
            final_agreed_score: 62,
            final_agreed_feedback: "Feedback",
            moderated_at: null,
            approved_at: null,
            created_at: "2026-04-21T10:00:00.000Z",
            updated_at: "2026-04-21T10:00:00.000Z",
          },
          submission: { id: "submission-escalated-alpha", status: "escalated" } as never,
          grade: { id: "grade-2" } as never,
          assignment: { id: "assignment-alpha", title: "Assignment Alpha" } as never,
          firstMarker: null,
          moderator: null,
          integrityReview: null,
          reviews: [],
          auditLog: [],
        },
        {
          moderationCase: {
            id: "case-escalated-beta",
            submission_id: "submission-escalated-beta",
            assignment_id: "assignment-beta",
            grade_id: "grade-3",
            lecturer_id: "owner-1",
            first_marker_id: "marker-1",
            moderator_id: "moderator-1",
            status: "escalated",
            trigger_flags: [],
            trigger_summary: null,
            confidence_score: null,
            integrity_risk_score: null,
            ai_score_snapshot: null,
            first_marker_score: 67,
            moderator_score: 62,
            final_agreed_score: 62,
            final_agreed_feedback: "Feedback",
            moderated_at: null,
            approved_at: null,
            created_at: "2026-04-21T10:00:00.000Z",
            updated_at: "2026-04-21T10:00:00.000Z",
          },
          submission: { id: "submission-escalated-beta", status: "escalated" } as never,
          grade: { id: "grade-3" } as never,
          assignment: { id: "assignment-beta", title: "Assignment Beta" } as never,
          firstMarker: null,
          moderator: null,
          integrityReview: null,
          reviews: [],
          auditLog: [],
        },
        {
          moderationCase: {
            id: "case-other-owner",
            submission_id: "submission-other-owner",
            assignment_id: "assignment-gamma",
            grade_id: "grade-4",
            lecturer_id: "owner-2",
            first_marker_id: "marker-1",
            moderator_id: "moderator-1",
            status: "moderated",
            trigger_flags: [],
            trigger_summary: null,
            confidence_score: null,
            integrity_risk_score: null,
            ai_score_snapshot: null,
            first_marker_score: 67,
            moderator_score: 67,
            final_agreed_score: 67,
            final_agreed_feedback: "Feedback",
            moderated_at: null,
            approved_at: "2026-04-22T10:00:00.000Z",
            created_at: "2026-04-21T10:00:00.000Z",
            updated_at: "2026-04-21T10:00:00.000Z",
          },
          submission: { id: "submission-other-owner", status: "approved" } as never,
          grade: { id: "grade-4" } as never,
          assignment: { id: "assignment-gamma", title: "Assignment Gamma" } as never,
          firstMarker: null,
          moderator: null,
          integrityReview: null,
          reviews: [],
          auditLog: [],
        },
      ] as ModerationCaseView[],
      "owner-1",
    );

    expect(summaries).toEqual([
      {
        assignmentId: "assignment-alpha",
        assignmentTitle: "Assignment Alpha",
        approvedReadyCount: 1,
        escalatedCount: 1,
      },
      {
        assignmentId: "assignment-beta",
        assignmentTitle: "Assignment Beta",
        approvedReadyCount: 0,
        escalatedCount: 1,
      },
    ]);
  });
});
