import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAutomatedAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions";
import type { AssignmentDetailAssignment, AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const mocks = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  log: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  persistWorkflowNotification: vi.fn().mockResolvedValue(undefined),
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.log,
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "pk_test",
  }),
}));

vi.mock("@/pages/dashboard/assignment-detail/workflows/submissionActions", () => ({
  persistWorkflowNotification: mocks.persistWorkflowNotification,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

const buildAssignment = (): AssignmentDetailAssignment => ({
  id: "assignment-1",
  title: "Essay",
  description: null,
  module_code: "EDU401",
  max_score: 100,
  due_date: null,
  status: "published",
  lecturer_id: "lecturer-1",
  rubric: [],
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
});

const buildSubmission = (
  id: string,
  status: AssignmentDetailSubmission["status"] = "submitted",
): AssignmentDetailSubmission => ({
  id,
  assignment_id: "assignment-1",
  student_id: `student-${id}`,
  student_name: `Student ${id}`,
  student_email: `${id}@example.com`,
  file_name: `${id}.pdf`,
  file_type: "application/pdf",
  file_url: `bucket/${id}.pdf`,
  status,
  submitted_at: "2026-05-25T12:00:00.000Z",
});

describe("useAutomatedAssessmentActions workflow behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token",
        },
      },
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }

      if (table === "grades") {
        return {
          upsert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            submissionId: "submission-1",
            success: true,
            score: 71,
            feedback: "Solid work.",
            breakdown: [],
            requiresLecturerReview: false,
            gradingConfidence: 0.81,
          },
        ],
      }),
    }) as unknown as typeof fetch;
  });

  it("sends only the currently selected submission id when grading one submission", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const setPinnedVisibleSubmissionIds = vi.fn();

    const { result } = renderHook(() =>
      useAutomatedAssessmentActions({
        assignment: buildAssignment(),
        grades: {},
        isDemo: false,
        reloadSubmissions,
        role: "lecturer",
        selected: new Set(["submission-1"]),
        setPinnedVisibleSubmissionIds,
        setPlagiarismFlags: vi.fn(),
        setPlagiarismSummary: vi.fn(),
        setSelected: vi.fn(),
        submissions: [buildSubmission("submission-1"), buildSubmission("submission-2")],
        user: { id: "lecturer-1" },
      }),
    );

    await act(async () => {
      await result.current.handleAIGrade();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(String(fetchCall[1]?.body));
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0].id).toBe("submission-1");
  });

  it("pins successfully started grading submissions in view and skips rows that fail the ai_grading transition", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const setPinnedVisibleSubmissionIds = vi.fn();

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn((column: string, submissionId: string) =>
              Promise.resolve({
                error:
                  column === "id" && submissionId === "submission-2"
                    ? { message: "status update failed" }
                    : null,
              }),
            ),
          })),
        };
      }

      if (table === "grades") {
        return {
          upsert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() =>
      useAutomatedAssessmentActions({
        assignment: buildAssignment(),
        grades: {},
        isDemo: false,
        reloadSubmissions,
        role: "lecturer",
        selected: new Set(["submission-1", "submission-2"]),
        setPinnedVisibleSubmissionIds,
        setPlagiarismFlags: vi.fn(),
        setPlagiarismSummary: vi.fn(),
        setSelected: vi.fn(),
        submissions: [buildSubmission("submission-1"), buildSubmission("submission-2")],
        user: { id: "lecturer-1" },
      }),
    );

    await act(async () => {
      await result.current.handleAIGrade();
    });

    expect(setPinnedVisibleSubmissionIds).toHaveBeenCalledWith(["submission-1"]);
    const body = JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));
    expect(body.submissions).toEqual([
      expect.objectContaining({
        id: "submission-1",
      }),
    ]);
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "1 submission(s) could not be moved into AI grading and were skipped.",
    );
  });

  it("surfaces a safe error and does not call grading when every ai_grading transition fails", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const setPinnedVisibleSubmissionIds = vi.fn();

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: { message: "status update failed" } })),
          })),
        };
      }

      if (table === "grades") {
        return {
          upsert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() =>
      useAutomatedAssessmentActions({
        assignment: buildAssignment(),
        grades: {},
        isDemo: false,
        reloadSubmissions,
        role: "lecturer",
        selected: new Set(["submission-1"]),
        setPinnedVisibleSubmissionIds,
        setPlagiarismFlags: vi.fn(),
        setPlagiarismSummary: vi.fn(),
        setSelected: vi.fn(),
        submissions: [buildSubmission("submission-1")],
        user: { id: "lecturer-1" },
      }),
    );

    await act(async () => {
      await result.current.handleAIGrade();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "Could not start AI grading because the selected workflow state could not be updated.",
    );
    await waitFor(() => {
      expect(result.current.grading).toBe(false);
    });
  });
});
