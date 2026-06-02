import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLecturerAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows/useLecturerAssessmentActions";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  ModerationCase,
} from "@/pages/dashboard/assignment-detail/types";

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
  insertModerationAuditEntry: vi.fn().mockResolvedValue({ error: null }),
  buildModerationAuditPayload: vi.fn((payload) => payload),
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.log,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@/lib/moderationWorkflow", () => ({
  buildModerationAuditPayload: mocks.buildModerationAuditPayload,
  insertModerationAuditEntry: mocks.insertModerationAuditEntry,
}));

vi.mock("@/lib/communications", () => ({
  buildGradeReleasedNotification: vi.fn(),
  queueCommunicationMessage: vi.fn(),
}));

vi.mock("@/lib/gradeReleaseWorkflow", () => ({
  executeGradeRelease: vi.fn(),
  summarizeGradeReleaseBatch: vi.fn(),
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
});

const buildSubmission = (status: AssignmentDetailSubmission["status"]): AssignmentDetailSubmission => ({
  id: "submission-1",
  assignment_id: "assignment-1",
  student_id: "student-1",
  student_name: "Student 1",
  student_email: "student@example.com",
  file_name: "essay.pdf",
  file_type: "application/pdf",
  file_url: "bucket/essay.pdf",
  status,
  submitted_at: "2026-05-25T12:00:00.000Z",
});

const buildGrade = (): Grade => ({
  id: "grade-1",
  submission_id: "submission-1",
  ai_score: 71,
  ai_feedback: "AI feedback",
  ai_breakdown: [],
  assignment_type: "essay",
  grading_confidence: 0.82,
  grading_metadata: null,
  lecturer_score: 68,
  lecturer_feedback: "Lecturer feedback",
  final_score: null,
  final_feedback: null,
});

describe("useLecturerAssessmentActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "grades") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: { message: "grade update failed" } })),
          })),
        };
      }

      if (table === "submissions") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }

      return {
        update: vi.fn(),
        insert: vi.fn(),
      };
    });
  });

  it("keeps the review dialog open when saving the review fails", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const setModerationCases = vi.fn();
    const setSelected = vi.fn();

    const { result } = renderHook(() =>
      useLecturerAssessmentActions({
        assignment: buildAssignment(),
        grades: { "submission-1": buildGrade() },
        isDemo: false,
        moderationCases: {} as Record<string, ModerationCase>,
        reloadSubmissions,
        selected: new Set(),
        setModerationCases,
        setSelected,
        submissions: [buildSubmission("first_review")],
        user: { id: "lecturer-1" },
      }),
    );

    act(() => {
      result.current.openReview(buildSubmission("first_review"));
      result.current.setEditScore("80");
      result.current.setEditFeedback("Updated feedback");
    });

    await act(async () => {
      await result.current.saveReview();
    });

    expect(mocks.toast.error).toHaveBeenCalledWith("Failed to save review");
    expect(result.current.reviewOpen).toBe(true);
    expect(result.current.reviewSubmission?.id).toBe("submission-1");
    expect(reloadSubmissions).not.toHaveBeenCalled();
    expect(setModerationCases).not.toHaveBeenCalled();
  });
});
