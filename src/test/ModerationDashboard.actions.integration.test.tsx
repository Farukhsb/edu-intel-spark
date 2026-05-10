import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";
import {
  cleanupModerationDashboardMocks,
  renderModerationDashboard,
} from "@/test/helpers/renderModerationDashboard";

type UpdateCall = {
  table: string;
  payload: Record<string, unknown>;
};

type InsertCall = {
  table: string;
  payload: unknown;
};

const createSupabaseMock = () => {
  const updateCalls: UpdateCall[] = [];
  const insertCalls: InsertCall[] = [];

  return {
    updateCalls,
    insertCalls,
    from: vi.fn((table: string) => ({
      update: vi.fn((payload: Record<string, unknown>) => {
        updateCalls.push({ table, payload });
        return {
          eq: vi.fn(async () => ({ error: null })),
        };
      }),
      insert: vi.fn(async (payload: unknown) => {
        insertCalls.push({ table, payload });
        return { error: null };
      }),
    })),
  };
};

const assignedCase: ModerationCaseView = {
  moderationCase: {
    id: "case-1",
    submission_id: "submission-1",
    assignment_id: "assignment-1",
    grade_id: "grade-1",
    lecturer_id: "lecturer-1",
    first_marker_id: "lecturer-1",
    moderator_id: "moderator-1",
    status: "moderation_in_progress",
    trigger_flags: ["boundary_score"],
    trigger_summary: "Boundary score requires moderation.",
    confidence_score: 0.62,
    integrity_risk_score: null,
    ai_score_snapshot: 61,
    first_marker_score: 67,
    moderator_score: null,
    final_agreed_score: null,
    final_agreed_feedback: null,
    approved_at: null,
    moderated_at: null,
    created_at: "2026-04-22T10:00:00.000Z",
    updated_at: "2026-04-22T10:00:00.000Z",
  },
  submission: {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_name: "Sarah Student",
    student_email: "sarah@student.test",
    student_id: "student-1",
    file_name: "essay.pdf",
    file_type: "application/pdf",
    file_url: "student-1/assignment-1/essay.pdf",
    status: "moderation_in_progress",
    submitted_at: "2026-04-22T09:00:00.000Z",
    uploaded_by: "student-1",
  } as never,
  grade: {
    id: "grade-1",
    submission_id: "submission-1",
    ai_score: 61,
    ai_feedback: "AI feedback",
    ai_breakdown: [],
    assignment_type: null,
    created_at: "2026-04-22T10:00:00.000Z",
    final_feedback: null,
    final_score: null,
    grading_confidence: 0.62,
    grading_metadata: {},
    lecturer_feedback: "Lecturer feedback",
    lecturer_score: 67,
    reviewed_at: null,
    reviewed_by: null,
  },
  assignment: {
    id: "assignment-1",
    title: "Policy Case Study",
    description: "Policy analysis",
    due_date: "2026-04-20T09:00:00.000Z",
    file_url: null,
    lecturer_id: "lecturer-1",
    max_score: 100,
    module_code: "POL305",
    rubric: [],
    status: "published",
    created_at: "2026-04-22T10:00:00.000Z",
    updated_at: "2026-04-22T10:00:00.000Z",
  } as never,
  firstMarker: {
    id: "lecturer-1",
    full_name: "Dr. Ada Lecturer",
    email: "lecturer@gradeai.test",
    role: "lecturer",
    avatar_url: null,
    cohort_id: null,
    department_id: null,
    created_at: "2026-04-22T10:00:00.000Z",
    updated_at: "2026-04-22T10:00:00.000Z",
  } as never,
  moderator: {
    id: "moderator-1",
    full_name: "Morgan Moderator",
    email: "moderator@gradeai.test",
    role: "lecturer",
    avatar_url: null,
    cohort_id: null,
    department_id: null,
    created_at: "2026-04-22T10:00:00.000Z",
    updated_at: "2026-04-22T10:00:00.000Z",
  } as never,
  integrityReview: null,
  reviews: [],
  auditLog: [],
};

const renderAssignedModerationDashboard = async () => {
  const supabaseMock = createSupabaseMock();
  await renderModerationDashboard({
    auth: {
      user: { id: "moderator-1", email: "moderator@gradeai.test" },
      profile: { id: "moderator-1", role: "lecturer" },
    },
    cases: [assignedCase],
    supabase: supabaseMock,
  });

  return supabaseMock;
};

describe("ModerationDashboard moderator integration", () => {
  afterEach(() => {
    cleanup();
    cleanupModerationDashboardMocks();
  });

  it("shows an assigned case to the moderator with student context and an enabled review action", async () => {
    await renderAssignedModerationDashboard();

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    const openButton = within(caseRow).getByTestId("moderation-review-open-case-1");

    expect(caseRow).toHaveTextContent("Sarah Student");
    expect(caseRow).toHaveTextContent("Policy Case Study");
    expect(caseRow).toHaveTextContent("Morgan Moderator");
    expect(openButton).toBeEnabled();
  }, 20000);

  it.each([
    { action: "agree", expectedCaseStatus: "moderated", expectedSubmissionStatus: "moderated" },
    { action: "adjust", expectedCaseStatus: "moderated", expectedSubmissionStatus: "moderated" },
    { action: "return", expectedCaseStatus: "first_review", expectedSubmissionStatus: "first_review" },
    { action: "escalate", expectedCaseStatus: "escalated", expectedSubmissionStatus: "escalated" },
  ])("allows the assigned moderator to call the $action action", async ({ action, expectedCaseStatus, expectedSubmissionStatus }) => {
    const supabaseMock = await renderAssignedModerationDashboard();

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    const openButton = within(caseRow).getByTestId("moderation-review-open-case-1");
    expect(openButton).toBeEnabled();

    fireEvent.click(openButton);

    await screen.findByTestId("moderation-review-dialog");
    expect(screen.getByTestId(`moderation-action-${action}`)).toBeEnabled();

    fireEvent.click(screen.getByTestId(`moderation-action-${action}`));

    await waitFor(() => {
      expect(
        supabaseMock.updateCalls.some(
          (call) => call.table === "moderation_cases" && call.payload.status === expectedCaseStatus
        )
      ).toBe(true);
    });

    expect(
      supabaseMock.updateCalls.some(
        (call) => call.table === "submissions" && call.payload.status === expectedSubmissionStatus
      )
    ).toBe(true);
    expect(supabaseMock.insertCalls.some((call) => call.table === "moderation_reviews")).toBe(true);
    expect(supabaseMock.insertCalls.some((call) => call.table === "grade_audit_log")).toBe(true);
  }, 20000);

  it("disables moderator actions for a lecturer who is not the assigned moderator or owner", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "other-lecturer", email: "other@gradeai.test" },
        profile: { id: "other-lecturer", role: "lecturer" },
      },
      cases: [assignedCase],
      supabase: createSupabaseMock(),
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    await screen.findByTestId("moderation-review-dialog");
    expect(screen.getByTestId("moderation-action-agree")).toBeDisabled();
    expect(screen.getByTestId("moderation-action-adjust")).toBeDisabled();
    expect(screen.getByTestId("moderation-action-return")).toBeDisabled();
    expect(screen.getByTestId("moderation-action-escalate")).toBeDisabled();
    expect(screen.getByTestId("moderation-action-approve")).toBeDisabled();
  }, 20000);

  it("keeps approval disabled for the owner until moderation is complete", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [assignedCase],
      supabase: createSupabaseMock(),
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    await screen.findByTestId("moderation-review-dialog");
    expect(screen.getByTestId("moderation-action-approve")).toBeDisabled();
  }, 20000);

  it("shows that the moderator confirmed the outcome when no material change exists", async () => {
    await renderAssignedModerationDashboard();

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    await screen.findByTestId("moderation-review-dialog");
    expect(screen.queryByText("Moderator confirmed the first marker decision.")).not.toBeInTheDocument();
  }, 20000);

  it("shows disagreement context when the moderator materially changed the outcome", async () => {
    const adjustedCase: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        status: "moderated",
        moderator_score: 62,
        final_agreed_score: 62,
        final_agreed_feedback: "Moderator feedback",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            status: "moderated",
          }
        : assignedCase.submission,
      reviews: [
        {
          id: "review-1",
          moderation_case_id: "case-1",
          submission_id: "submission-1",
          reviewer_id: "moderator-1",
          reviewer_role: "moderator",
          action: "adjust",
          proposed_score: 62,
          proposed_feedback: "Moderator feedback",
          notes: "Adjusted after reviewing comparative evidence.",
          snapshot: {},
          created_at: "2026-04-22T11:00:00.000Z",
        } as never,
      ],
    };

    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [adjustedCase],
      supabase: createSupabaseMock(),
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    expect(caseRow).toHaveTextContent("Moderator changed both the score and feedback.");
    expect(caseRow).toHaveTextContent("Moderator changed outcome");

    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    const dialog = await screen.findByTestId("moderation-review-dialog");
    expect(within(dialog).getByText("Moderator changed both the score and feedback.")).toBeInTheDocument();
    expect(within(dialog).getByText("First marker score: 67 | Moderator score: 62")).toBeInTheDocument();
    expect(within(dialog).getByText("Feedback change: Changed")).toBeInTheDocument();
  }, 20000);

  it("shows escalated cases as unresolved disputes with escalation context", async () => {
    const escalatedCase: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        status: "escalated",
        moderator_score: 62,
        final_agreed_score: 62,
        final_agreed_feedback: "Moderator feedback",
        trigger_summary: "Moderator could not close the disagreement.",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            status: "escalated",
          }
        : assignedCase.submission,
      reviews: [
        {
          id: "review-2",
          moderation_case_id: "case-1",
          submission_id: "submission-1",
          reviewer_id: "moderator-1",
          reviewer_role: "moderator",
          action: "escalate",
          proposed_score: 62,
          proposed_feedback: "Moderator feedback",
          notes: "Moderator could not close the disagreement.",
          snapshot: {},
          created_at: "2026-04-22T11:30:00.000Z",
        } as never,
      ],
    };

    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [escalatedCase],
      supabase: createSupabaseMock(),
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    expect(caseRow).toHaveTextContent("Escalated after the moderator changed the outcome.");
    expect(caseRow).toHaveTextContent(
      "This case is still unresolved and needs owner or senior review before final approval.",
    );
    expect(caseRow).toHaveTextContent("Escalated dispute");
    expect(caseRow).toHaveTextContent("Escalated dispute needs owner or senior review");

    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    const dialog = await screen.findByTestId("moderation-review-dialog");
    expect(within(dialog).getByTestId("moderation-dialog-next-step")).toHaveTextContent(
      "Escalated dispute needs owner or senior review",
    );
    expect(within(dialog).getByText("Escalated after the moderator changed the outcome.")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This case is still unresolved and needs owner or senior review before final approval.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("First marker score: 67 | Moderator score: 62")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Escalation reason: Moderator could not close the disagreement."),
    ).toBeInTheDocument();
  }, 20000);

  it("shows moderated cases as awaiting owner approval before release", async () => {
    const moderatedCase: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        status: "moderated",
        moderator_score: 67,
        final_agreed_score: 67,
        final_agreed_feedback: "Confirmed final feedback",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            status: "moderated",
          }
        : assignedCase.submission,
      reviews: [
        {
          id: "review-3",
          moderation_case_id: "case-1",
          submission_id: "submission-1",
          reviewer_id: "moderator-1",
          reviewer_role: "moderator",
          action: "agree",
          proposed_score: 67,
          proposed_feedback: "Confirmed final feedback",
          notes: "Moderator confirmed the first marker decision.",
          snapshot: {},
          created_at: "2026-04-22T12:00:00.000Z",
        } as never,
      ],
    };

    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [moderatedCase],
      supabase: createSupabaseMock(),
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    expect(caseRow).toHaveTextContent("Owner approval required");
    expect(caseRow).toHaveTextContent("Assignment owner approval required");

    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    const dialog = await screen.findByTestId("moderation-review-dialog");
    expect(within(dialog).getByTestId("moderation-dialog-next-step")).toHaveTextContent(
      "Assignment owner approval required",
    );
    expect(within(dialog).getByText("Owner approval required")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This case is moderated but still needs assignment-owner approval before any grade release.",
      ),
    ).toBeInTheDocument();
  }, 20000);

  it("shows approved cases as ready for release", async () => {
    const approvedCase: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        status: "moderated",
        moderator_score: 67,
        final_agreed_score: 67,
        final_agreed_feedback: "Approved final feedback",
        approved_at: "2026-04-22T12:30:00.000Z",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            status: "approved",
          }
        : assignedCase.submission,
      reviews: [
        {
          id: "review-4",
          moderation_case_id: "case-1",
          submission_id: "submission-1",
          reviewer_id: "moderator-1",
          reviewer_role: "moderator",
          action: "agree",
          proposed_score: 67,
          proposed_feedback: "Approved final feedback",
          notes: "Moderator confirmed the first marker decision.",
          snapshot: {},
          created_at: "2026-04-22T12:00:00.000Z",
        } as never,
      ],
    };

    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [approvedCase],
      supabase: createSupabaseMock(),
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    expect(caseRow).toHaveTextContent("Ready for release");
    expect(caseRow).toHaveTextContent("Release the approved outcome");

    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    const dialog = await screen.findByTestId("moderation-review-dialog");
    expect(within(dialog).getByTestId("moderation-dialog-next-step")).toHaveTextContent(
      "Release the approved outcome",
    );
    expect(within(dialog).getByText("Ready for release")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This case has owner approval and can now be released to the student from the assignment workflow.",
      ),
    ).toBeInTheDocument();
  }, 20000);

  it("allows the assignment owner to bulk assign a moderator across selected pending cases", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });

    const pendingCaseA: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        id: "case-bulk-a",
        submission_id: "submission-bulk-a",
        lecturer_id: "lecturer-1",
        moderator_id: null,
        status: "moderation_pending",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            id: "submission-bulk-a",
            status: "moderation_pending",
            student_name: "Bulk Student A",
          }
        : assignedCase.submission,
      moderator: null,
    };

    const pendingCaseB: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        id: "case-bulk-b",
        submission_id: "submission-bulk-b",
        lecturer_id: "lecturer-1",
        moderator_id: null,
        status: "moderation_pending",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            id: "submission-bulk-b",
            status: "moderation_pending",
            student_name: "Bulk Student B",
          }
        : assignedCase.submission,
      moderator: null,
    };

    const supabaseMock = createSupabaseMock();
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [pendingCaseA, pendingCaseB],
      lecturers: [pendingCaseA.firstMarker, assignedCase.moderator].filter(Boolean),
      supabase: supabaseMock,
    });

    await screen.findByTestId("moderation-case-case-bulk-a", {}, { timeout: 15000 });

    fireEvent.click(screen.getByTestId("moderation-select-case-bulk-a"));
    fireEvent.click(screen.getByTestId("moderation-select-case-bulk-b"));
    expect(screen.getByText("2 case(s) selected")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("moderation-bulk-moderator-select"), {
      target: { value: "moderator-1" },
    });
    expect(screen.getByTestId("moderation-bulk-assign")).toBeEnabled();
    fireEvent.click(screen.getByTestId("moderation-bulk-assign"));

    await waitFor(() => {
      expect(
        supabaseMock.updateCalls.filter(
          (call) => call.table === "moderation_cases" && call.payload.moderator_id === "moderator-1",
        ).length,
      ).toBe(2);
    });

    expect(
      supabaseMock.updateCalls.filter(
        (call) => call.table === "submissions" && call.payload.status === "moderation_in_progress",
      ).length,
    ).toBe(2);
    expect(
      supabaseMock.insertCalls.filter((call) => call.table === "grade_audit_log").length,
    ).toBe(2);
  }, 20000);

  it("allows the assignment owner to bulk approve moderated cases after previewing disagreement summaries", async () => {
    const moderatedCaseA: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        id: "case-approve-a",
        submission_id: "submission-approve-a",
        grade_id: "grade-approve-a",
        lecturer_id: "lecturer-1",
        status: "moderated",
        moderator_score: 62,
        final_agreed_score: 62,
        final_agreed_feedback: "Moderator final feedback A",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            id: "submission-approve-a",
            status: "moderated",
            student_name: "Approval Student A",
          }
        : assignedCase.submission,
      grade: assignedCase.grade
        ? {
            ...assignedCase.grade,
            id: "grade-approve-a",
            submission_id: "submission-approve-a",
            final_score: null,
            final_feedback: null,
          }
        : assignedCase.grade,
      reviews: [
        {
          id: "review-approve-a",
          moderation_case_id: "case-approve-a",
          submission_id: "submission-approve-a",
          reviewer_id: "moderator-1",
          reviewer_role: "moderator",
          action: "adjust",
          proposed_score: 62,
          proposed_feedback: "Moderator final feedback A",
          notes: "Adjusted after review.",
          snapshot: {},
          created_at: "2026-04-22T11:00:00.000Z",
        } as never,
      ],
    };

    const moderatedCaseB: ModerationCaseView = {
      ...assignedCase,
      moderationCase: {
        ...assignedCase.moderationCase,
        id: "case-approve-b",
        submission_id: "submission-approve-b",
        grade_id: "grade-approve-b",
        lecturer_id: "lecturer-1",
        status: "moderated",
        moderator_score: 67,
        final_agreed_score: 67,
        final_agreed_feedback: "Confirmed final feedback B",
      },
      submission: assignedCase.submission
        ? {
            ...assignedCase.submission,
            id: "submission-approve-b",
            status: "moderated",
            student_name: "Approval Student B",
          }
        : assignedCase.submission,
      grade: assignedCase.grade
        ? {
            ...assignedCase.grade,
            id: "grade-approve-b",
            submission_id: "submission-approve-b",
            final_score: null,
            final_feedback: null,
          }
        : assignedCase.grade,
      reviews: [
        {
          id: "review-approve-b",
          moderation_case_id: "case-approve-b",
          submission_id: "submission-approve-b",
          reviewer_id: "moderator-1",
          reviewer_role: "moderator",
          action: "agree",
          proposed_score: 67,
          proposed_feedback: "Lecturer feedback",
          notes: "Confirmed first marker outcome.",
          snapshot: {},
          created_at: "2026-04-22T11:15:00.000Z",
        } as never,
      ],
    };

    const supabaseMock = createSupabaseMock();
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [moderatedCaseA, moderatedCaseB],
      supabase: supabaseMock,
    });

    await screen.findByTestId("moderation-case-case-approve-a", {}, { timeout: 15000 });

    fireEvent.click(screen.getByTestId("moderation-select-case-approve-a"));
    fireEvent.click(screen.getByTestId("moderation-select-case-approve-b"));

    expect(screen.getByTestId("moderation-bulk-approve")).toBeEnabled();
    expect(screen.getByTestId("moderation-bulk-approval-summary-case-approve-a")).toHaveTextContent(
      "Moderator changed both the score and feedback.",
    );
    expect(screen.getByTestId("moderation-bulk-approval-summary-case-approve-b")).toHaveTextContent(
      "Moderator confirmed the first marker decision.",
    );

    fireEvent.click(screen.getByTestId("moderation-bulk-approve"));

    await waitFor(() => {
      expect(
        supabaseMock.updateCalls.filter(
          (call) => call.table === "moderation_cases" && typeof call.payload.approved_at === "string",
        ).length,
      ).toBe(2);
    });

    expect(
      supabaseMock.updateCalls.filter(
        (call) => call.table === "submissions" && call.payload.status === "approved",
      ).length,
    ).toBe(2);
    expect(
      supabaseMock.updateCalls.filter(
        (call) =>
          call.table === "grades" &&
          typeof call.payload.reviewed_at === "string" &&
          call.payload.reviewed_by === "lecturer-1",
      ).length,
    ).toBe(2);
    expect(
      supabaseMock.insertCalls.filter((call) => call.table === "grade_audit_log").length,
    ).toBe(2);
  }, 20000);
});
