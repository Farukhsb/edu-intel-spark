import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  queueCommunicationMessage: vi.fn().mockResolvedValue(true),
  buildGradeReleasedNotification: vi.fn((payload) => payload),
  executeGradeRelease: vi.fn().mockResolvedValue({ released: true }),
  summarizeGradeReleaseBatch: vi.fn(() => ({
    releasedCount: 1,
    updateFailureCount: 0,
    auditFailureCount: 0,
    notificationFailureCount: 0,
    emailFailureCount: 0,
  })),
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
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
  buildGradeReleasedNotification: mocks.buildGradeReleasedNotification,
  queueCommunicationMessage: mocks.queueCommunicationMessage,
}));

vi.mock("@/lib/gradeReleaseWorkflow", () => ({
  executeGradeRelease: mocks.executeGradeRelease,
  summarizeGradeReleaseBatch: mocks.summarizeGradeReleaseBatch,
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

const buildSubmission = (id: string, status: AssignmentDetailSubmission["status"]): AssignmentDetailSubmission => ({
  id,
  assignment_id: "assignment-1",
  student_id: `${id}-student`,
  student_name: `Student ${id}`,
  student_email: `${id}@example.com`,
  file_name: `${id}.pdf`,
  file_type: "application/pdf",
  file_url: `bucket/${id}.pdf`,
  status,
  submitted_at: "2026-05-25T12:00:00.000Z",
});

const buildGrade = (submissionId: string): Grade => ({
  id: `${submissionId}-grade`,
  submission_id: submissionId,
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

const buildModerationCase = (submissionId: string): ModerationCase =>
  ({
    id: `${submissionId}-moderation`,
    submission_id: submissionId,
  }) as ModerationCase;

describe("useLecturerAssessmentActions coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertModerationAuditEntry.mockResolvedValue({ error: null });
    mocks.queueCommunicationMessage.mockResolvedValue(true);
    mocks.executeGradeRelease.mockResolvedValue({ released: true });
    mocks.summarizeGradeReleaseBatch.mockReturnValue({
      releasedCount: 1,
      updateFailureCount: 0,
      auditFailureCount: 0,
      notificationFailureCount: 0,
      emailFailureCount: 0,
    });
    mocks.supabase.rpc.mockResolvedValue({ data: buildModerationCase("submission-1"), error: null });
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "grades") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: buildGrade("submission-1"),
                  error: null,
                }),
              ),
            })),
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

      if (table === "moderation_cases") {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("covers guard branches for demo mode, missing grades, and empty selections", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useLecturerAssessmentActions({
        assignment: null,
        grades: {},
        isDemo: true,
        moderationCases: {},
        reloadSubmissions,
        selected: new Set(),
        setModerationCases: vi.fn(),
        setSelected: vi.fn(),
        submissions: [],
        user: null,
      }),
    );

    await act(async () => {
      await result.current.handleBulkApprove();
      await result.current.sendToModeration(buildSubmission("submission-1", "submitted"));
      await result.current.queueFeedbackSummary(buildSubmission("submission-1", "submitted"));
      await result.current.queueGradeReleaseNotification(buildSubmission("submission-1", "submitted"));
      await result.current.handleReleaseGrades();
      await result.current.startManualReviewForSubmissions([]);
      await result.current.approveSubmission(buildSubmission("submission-1", "submitted"));
      await result.current.handleSingleRelease(buildSubmission("submission-1", "submitted"));
    });

    expect(mocks.toast.error).toHaveBeenCalledWith("Select reviewed submissions to approve");
    expect(mocks.toast.info).toHaveBeenCalledWith("Moderation handoff is disabled in demo mode");
    expect(mocks.toast.error).toHaveBeenCalledWith("No grade available to summarise");
    expect(mocks.toast.error).toHaveBeenCalledWith("Could not save release note");
    expect(mocks.toast.error).toHaveBeenCalledWith("Select approved submissions to release");
    expect(mocks.toast.info).toHaveBeenCalledWith("No failed submissions are ready for manual review.");
    expect(mocks.toast.error).toHaveBeenCalledWith("Failed to release grade");
    expect(reloadSubmissions).not.toHaveBeenCalled();

    const approvalReload = vi.fn().mockResolvedValue(undefined);
    const { result: approvalResult } = renderHook(() =>
      useLecturerAssessmentActions({
        assignment: buildAssignment(),
        grades: {},
        isDemo: false,
        moderationCases: {},
        reloadSubmissions: approvalReload,
        selected: new Set(),
        setModerationCases: vi.fn(),
        setSelected: vi.fn(),
        submissions: [buildSubmission("submission-1", "submitted")],
        user: { id: "lecturer-1" },
      }),
    );

    await act(async () => {
      await approvalResult.current.approveSubmission(buildSubmission("submission-1", "submitted"));
    });

    expect(mocks.toast.error).toHaveBeenCalledWith("No grade found to approve");
  });

  it("covers the manual-review insert path", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const setModerationCases = vi.fn();
    const setSelected = vi.fn();

    const { result } = renderHook(() =>
      useLecturerAssessmentActions({
        assignment: buildAssignment(),
        grades: {},
        isDemo: false,
        moderationCases: {},
        reloadSubmissions,
        selected: new Set(),
        setModerationCases,
        setSelected,
        submissions: [buildSubmission("first_review")],
        user: { id: "lecturer-1" },
      }),
    );

    await act(async () => {
      const started = await result.current.startManualReview(buildSubmission("first_review"), {
        openReview: false,
        skipReload: true,
      });
      expect(started).toBe(true);
    });

    expect(mocks.supabase.from).toHaveBeenCalledWith("grades");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("submissions");
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(reloadSubmissions).not.toHaveBeenCalled();
    expect(setModerationCases).not.toHaveBeenCalled();
    expect(setSelected).not.toHaveBeenCalled();
  });

  it("covers successful review, moderation, release, and manual-review branches", async () => {
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const setModerationCases = vi.fn();
    const setSelected = vi.fn();

    const submitted = buildSubmission("submission-1", "submitted");
    const reviewed = buildSubmission("submission-2", "first_review");
    const approvable = buildSubmission("submission-3", "ai_graded");
    const releasable = buildSubmission("submission-4", "approved");
    const grades = {
      "submission-1": buildGrade("submission-1"),
      "submission-2": buildGrade("submission-2"),
      "submission-3": buildGrade("submission-3"),
      "submission-4": buildGrade("submission-4"),
    };

    const { result } = renderHook(() =>
      useLecturerAssessmentActions({
        assignment: buildAssignment(),
        grades,
        isDemo: false,
        moderationCases: { "submission-4": buildModerationCase("submission-4") },
        reloadSubmissions,
        selected: new Set(["submission-3", "submission-4"]),
        setModerationCases,
        setSelected,
        submissions: [submitted, reviewed, approvable, releasable],
        user: { id: "lecturer-1" },
      }),
    );

    await act(async () => {
      const started = await result.current.startManualReview(submitted, { openReview: true, skipReload: true });
      expect(started).toBe(true);
    });

    act(() => {
      result.current.openReview(reviewed);
      result.current.setEditScore("77");
      result.current.setEditFeedback("Updated feedback");
    });

    await act(async () => {
      await result.current.saveReview();
      await result.current.sendToModeration(reviewed);
      await result.current.approveSubmission(approvable);
      await result.current.handleBulkApprove();
      await result.current.handleSingleRelease(releasable);
      await result.current.handleReleaseGrades();
      await result.current.queueFeedbackSummary(reviewed);
      await result.current.queueGradeReleaseNotification(releasable);
    });

    expect(mocks.supabase.rpc).toHaveBeenCalledWith("send_submission_to_moderation", {
      submission_id: "submission-2",
    });
    expect(mocks.queueCommunicationMessage).toHaveBeenCalled();
    expect(mocks.executeGradeRelease).toHaveBeenCalled();
    expect(mocks.summarizeGradeReleaseBatch).toHaveBeenCalled();
    expect(setModerationCases).toHaveBeenCalled();
    expect(setSelected).toHaveBeenCalled();
    expect(mocks.toast.success).toHaveBeenCalled();
    expect(reloadSubmissions).toHaveBeenCalled();
  });
});
