import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";

const fetchModerationCaseViewsMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
    profile: { id: "lecturer-1", role: "lecturer" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/lib/moderationWorkflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/moderationWorkflow")>("@/lib/moderationWorkflow");
  return {
    ...actual,
    fetchModerationCaseViews: fetchModerationCaseViewsMock,
  };
});

const baseCase = {
  moderationCase: {
    id: "case-1",
    submission_id: "submission-1",
    assignment_id: "assignment-1",
    grade_id: "grade-1",
    lecturer_id: "lecturer-1",
    first_marker_id: "lecturer-1",
    moderator_id: null,
    status: "moderation_pending",
    trigger_flags: [],
    trigger_summary: null,
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
  },
  moderator: null,
  integrityReview: null,
  reviews: [],
  auditLog: [],
} satisfies Omit<ModerationCaseView, "submission" | "assignment">;

const renderModerationDashboard = async (cases: ModerationCaseView[]) => {
  fetchModerationCaseViewsMock.mockResolvedValue({
    cases,
    lecturers: [],
  });

  const { default: ModerationDashboard } = await import("@/pages/dashboard/ModerationDashboard");

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ModerationDashboard />
    </MemoryRouter>
  );
};

const getCaseRow = () => screen.getByTestId("moderation-case-case-1");

describe("ModerationDashboard integration", () => {
  afterEach(() => {
    cleanup();
    fetchModerationCaseViewsMock.mockReset();
  });

  it("shows fallback moderation text and disables review when submission is unavailable", async () => {
    await renderModerationDashboard([
      {
        ...baseCase,
        submission: null,
        assignment: null,
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Student record unavailable")).toBeInTheDocument();
    });

    expect(getCaseRow()).toHaveTextContent("Assignment");
    expect(screen.getByTestId("moderation-review-open-case-1")).toBeDisabled();
  });

  it("shows live moderation text and enables review when submission and assignment are available", async () => {
    await renderModerationDashboard([
      {
        ...baseCase,
        submission: {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "Sarah Student",
          student_email: "sarah@student.test",
          student_id: "student-1",
          file_name: "essay.pdf",
          file_type: "application/pdf",
          file_url: "student-1/assignment-1/essay.pdf",
          status: "moderation_pending",
          submitted_at: "2026-04-22T09:00:00.000Z",
          uploaded_by: "student-1",
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
        },
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText("Sarah Student")).toBeInTheDocument();
    });

    expect(getCaseRow()).toHaveTextContent("Policy Case Study");
    expect(screen.getByTestId("moderation-review-open-case-1")).toBeEnabled();
  });
});
