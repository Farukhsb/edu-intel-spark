import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssignmentDetailListState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailListState";
import { useAssignmentDetailReadinessState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailReadinessState";
import { useAssignmentDetailReportActions } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailReportActions";
import { useStudentSubmissionState } from "@/pages/dashboard/assignment-detail/state/useStudentSubmissionState";
import { useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows/useSubmissionFileActions";
import type { AssignmentDetailAssignment, AssignmentDetailSubmission, Grade, ModerationCase } from "@/pages/dashboard/assignment-detail/types";
import { normalizeStudentKey, getSubmissionUploadFailureReason } from "@/pages/dashboard/assignment-detail/workflows/submissionActions";

const mocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  logReportExportEvent: vi.fn(),
  logAcademicAccessEvent: vi.fn(),
  logError: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/audit/exportAuditEvents", () => ({
  logReportExportEvent: mocks.logReportExportEvent,
}));

vi.mock("@/lib/audit/academicAccessEvents", () => ({
  logAcademicAccessEvent: mocks.logAcademicAccessEvent,
}));

vi.mock("@/lib/logger", () => ({
  log: {
    error: mocks.logError,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "lecturer-1",
      email: "lecturer@example.com",
    },
    profile: {
      id: "lecturer-1",
      email: "lecturer@example.com",
      role: "lecturer",
      institution_id: "institution-1",
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

vi.mock("@/lib/assessmentWorkflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assessmentWorkflow")>("@/lib/assessmentWorkflow");
  return actual;
});

vi.mock("@/lib/assignmentVisibility", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assignmentVisibility")>("@/lib/assignmentVisibility");
  return actual;
});

const createAssignment = (): AssignmentDetailAssignment => ({
  id: "assignment-1",
  title: "Essay 1",
  description: "Write an essay",
  module_code: "LAW101",
  max_score: 100,
  due_date: "2026-05-01",
  status: "published",
  lecturer_id: "lecturer-1",
  rubric: null,
});

const createSubmission = (overrides: Partial<AssignmentDetailSubmission> = {}): AssignmentDetailSubmission => ({
  id: "submission-1",
  assignment_id: "assignment-1",
  student_name: "Ada Ibrahim",
  student_email: "ada@example.edu",
  file_name: "ada-essay.pdf",
  file_type: "application/pdf",
  file_url: "submissions/ada-essay.pdf",
  status: "submitted",
  submitted_at: "2026-04-21T10:00:00Z",
  student_id: "student-1",
  ...overrides,
});

const createGrade = (): Grade => ({
  id: "grade-1",
  submission_id: "submission-1",
  ai_score: 74,
  ai_feedback: "AI feedback",
  ai_breakdown: null,
  assignment_type: null,
  grade_source: "ai",
  source_metadata: null,
  grading_confidence: 0.8,
  grading_metadata: null,
  lecturer_score: 76,
  lecturer_feedback: "Lecturer feedback",
  final_score: 76,
  final_feedback: "Final feedback",
});

describe("assignment detail hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("derives readiness and student submission state branches", () => {
    const submissions = [
      createSubmission({ status: "submitted", submitted_at: "2026-04-20T10:00:00Z", student_id: "student-1" }),
      createSubmission({ id: "submission-2", status: "released", submitted_at: "2026-04-21T10:00:00Z", student_id: "student-1" }),
      createSubmission({ id: "submission-3", status: "moderation_pending", student_id: "student-2" }),
    ];

    const readiness = renderHook(() =>
      useAssignmentDetailReadinessState({
        currentStudentSubmissionStatus: "submitted",
        isLecturer: true,
        submissions,
      }),
    );
    expect(readiness.result.current.workflowReadiness.postureLabel).toBe("Active review position");
    expect(readiness.result.current.integrityRuntimeWarning).toBeNull();

    const largeReadiness = renderHook(() =>
      useAssignmentDetailReadinessState({
        currentStudentSubmissionStatus: "submitted",
        isLecturer: true,
        submissions: Array.from({ length: 31 }, (_, index) => createSubmission({ id: `submission-${index + 1}` })),
      }),
    );
    expect(largeReadiness.result.current.integrityRuntimeWarning).toContain("Integrity scanning may take longer than usual");

    const studentSubmission = renderHook(() =>
      useStudentSubmissionState({
        assignment: createAssignment(),
        currentUserEmail: "ada@example.edu",
        currentUserId: "student-1",
        isLecturer: false,
        submissions,
      }),
    );
    expect(studentSubmission.result.current.hasExistingSubmission).toBe(true);
    expect(studentSubmission.result.current.currentStudentSubmission?.id).toBe("submission-2");
    expect(studentSubmission.result.current.studentSubmissionAvailability.canSubmit).toBe(false);

    const lecturerSubmission = renderHook(() =>
      useStudentSubmissionState({
        assignment: createAssignment(),
        currentUserEmail: null,
        currentUserId: "lecturer-1",
        isLecturer: true,
        submissions,
      }),
    );
    expect(lecturerSubmission.result.current.hasExistingSubmission).toBe(false);
    expect(lecturerSubmission.result.current.currentStudentSubmission).toBeNull();

    const loadingSubmission = renderHook(() =>
      useStudentSubmissionState({
        assignment: null,
        currentUserEmail: null,
        currentUserId: null,
        isLecturer: false,
        submissions: [],
      }),
    );
    expect(loadingSubmission.result.current.studentSubmissionAvailability.ctaLabel).toBe("Unavailable");
  });

  it("covers assignment list focus, selection, and queue branches", () => {
    const submissions = [
      createSubmission({ id: "submission-1", status: "submitted", file_name: "ada-essay.pdf", student_name: "Ada Ibrahim" }),
      createSubmission({ id: "submission-2", status: "ai_graded", file_name: "ben-essay.pdf", student_name: "Ben Carter" }),
      createSubmission({ id: "submission-3", status: "released", file_name: "cara-essay.pdf", student_name: "Cara Khan" }),
      createSubmission({ id: "submission-4", status: "moderation_pending", file_name: "dan-essay.pdf", student_name: "Dan Li" }),
    ];

    const { result, rerender } = renderHook(
      ({ search }) =>
        useAssignmentDetailListState({
          pinnedVisibleSubmissionIds: ["submission-3"],
          role: "lecturer",
          search,
          submissions,
        }),
      { initialProps: { search: "?source=queue&focus=manual-review" } },
    );

    expect(result.current.isLecturer).toBe(true);
    expect(result.current.queueFocusState?.statusFilter).toBe("under_review");
    expect(result.current.moderationReleaseHandoffState.kind).toBe("released");
    expect(result.current.filteredSubmissions.map((submission) => submission.id)).toContain("submission-3");

    act(() => {
      result.current.setSearchQuery("ada");
    });
    expect(result.current.searchQuery).toBe("ada");

    act(() => {
      result.current.setStatusFilter("released");
    });
    expect(result.current.statusFilter).toBe("released");

    act(() => {
      result.current.toggleSelect("submission-1");
    });
    expect(result.current.selected.has("submission-1")).toBe(true);

    act(() => {
      result.current.toggleAll();
    });
    expect(result.current.selected.size).toBe(0);

    rerender({ search: "?source=notification&focus=release-follow-up" });
    expect(result.current.notificationFocus).toBe("release-follow-up");

    const moderationFocused = renderHook(() =>
      useAssignmentDetailListState({
        role: "lecturer",
        search: "?source=moderation&focus=release-ready",
        submissions,
      }),
    );
    expect(moderationFocused.result.current.moderationReleaseFocus).toBe(true);
  });

  it("covers report actions, file actions, and submission action helpers", async () => {
    const assignment = createAssignment();
    const submissions = [
      createSubmission({ id: "submission-1", status: "released", file_url: "https://example.com/file.pdf" }),
      createSubmission({ id: "submission-2", status: "submitted", student_name: "Ben Carter", file_url: "submissions/ben.pdf" }),
    ];
    const grades = {
      "submission-1": createGrade(),
    };
    const navigate = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return {
          click: vi.fn(),
          href: "",
          download: "",
          rel: "",
          target: "",
          setAttribute: vi.fn(),
          removeAttribute: vi.fn(),
        } as never;
      }

      return originalCreateElement(tagName);
    });

    const { result } = renderHook(() =>
      useAssignmentDetailReportActions({
        assignment,
        actorId: "lecturer-1",
        actorRole: "lecturer",
        institutionId: "institution-1",
        grades,
        navigate,
        submissions,
      }),
    );

    result.current.openReleasedResult(submissions[0]);
    expect(navigate).toHaveBeenCalledWith("/dashboard?assignment=assignment-1&submission=submission-1&source=assignment-detail");

    result.current.exportReviewedReports();
    expect(mocks.logReportExportEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "lecturer-1",
        reportName: "reviewed_reports",
        rowCount: 1,
      }),
    );

    const noPermission = renderHook(() =>
      useAssignmentDetailReportActions({
        assignment,
        actorId: "student-1",
        actorRole: "student",
        institutionId: "institution-1",
        grades,
        navigate,
        submissions,
      }),
    );
    noPermission.result.current.exportReviewedReports();
    expect(mocks.toast.error).toHaveBeenCalledWith("Only lecturers and admins can export reviewed reports");

    const noReviewed = renderHook(() =>
      useAssignmentDetailReportActions({
        assignment,
        actorId: "lecturer-1",
        actorRole: "lecturer",
        institutionId: "institution-1",
        grades: {},
        navigate,
        submissions,
      }),
    );
    noReviewed.result.current.exportReviewedReports();
    expect(mocks.toast.error).toHaveBeenCalledWith("No reviewed submissions available to export");

    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example.com" }, error: null }),
    });

    const fileActions = renderHook(() => useSubmissionFileActions());
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    await fileActions.result.current.openSubmissionFile(submissions[0]);
    expect(windowOpen).toHaveBeenCalledWith("https://example.com/file.pdf", "_blank", "noopener,noreferrer");
    expect(mocks.logAcademicAccessEvent).toHaveBeenCalled();

    await fileActions.result.current.openSubmissionFile(submissions[1], { source: "assignment-detail" });
    expect(mocks.storageFrom).toHaveBeenCalledWith("submissions");
    expect(windowOpen).toHaveBeenCalledWith("https://signed.example.com", "_blank", "noopener,noreferrer");

    createElementSpy.mockRestore();
    windowOpen.mockRestore();
  });

  it("covers submission-action helper fallbacks", () => {
    expect(normalizeStudentKey("Ada-Ibrahim.pdf")).toBe("ada ibrahim");
    expect(normalizeStudentKey(null)).toBe("");
    expect(getSubmissionUploadFailureReason(new Error("  too large  "))).toBe("too large");
    expect(
      getSubmissionUploadFailureReason({
        message: "x".repeat(180),
      }),
    ).toHaveLength(160);
  });
});
