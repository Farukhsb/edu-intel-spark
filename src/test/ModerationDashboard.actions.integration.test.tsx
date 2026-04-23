import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
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

    await screen.findByText("Sarah Student");

    expect(screen.getByTestId("moderation-case-case-1")).toHaveTextContent("Policy Case Study");
    expect(screen.getByTestId("moderation-case-case-1")).toHaveTextContent("Morgan Moderator");
    expect(screen.getByTestId("moderation-review-open-case-1")).toBeEnabled();
  }, 10000);

  it.each([
    { action: "agree", expectedCaseStatus: "moderated", expectedSubmissionStatus: "moderated" },
    { action: "adjust", expectedCaseStatus: "moderated", expectedSubmissionStatus: "moderated" },
    { action: "return", expectedCaseStatus: "first_review", expectedSubmissionStatus: "first_review" },
    { action: "escalate", expectedCaseStatus: "escalated", expectedSubmissionStatus: "escalated" },
  ])("allows the assigned moderator to call the $action action", async ({ action, expectedCaseStatus, expectedSubmissionStatus }) => {
    const supabaseMock = await renderAssignedModerationDashboard();

    await screen.findByTestId("moderation-review-open-case-1");
    expect(screen.getByTestId("moderation-review-open-case-1")).toBeEnabled();

    fireEvent.click(screen.getByTestId("moderation-review-open-case-1"));

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
  }, 10000);
});
