import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { buildAbsoluteAppUrl } from "@/lib/clipboard";
import {
  buildFocusStateProps,
  buildHeroCardProps,
  buildReadinessCardProps,
  buildReviewDialogProps,
  buildSubmissionListProps,
  buildWorkflowActionsProps,
} from "@/pages/dashboard/assignment-detail/screen-props";
import type { AssignmentDetailAssignment, AssignmentDetailSubmission, Grade, ModerationCase } from "@/pages/dashboard/assignment-detail/types";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  copyTextToClipboard: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/clipboard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/clipboard")>("@/lib/clipboard");
  return {
    ...actual,
    copyTextToClipboard: mocks.copyTextToClipboard,
  };
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

const createGrades = (): Record<string, Grade> => ({
  "submission-1": {
    id: "grade-1",
    submission_id: "submission-1",
    ai_score: 74,
    ai_feedback: "Good work",
    ai_breakdown: null,
    assignment_type: null,
    grade_source: "ai",
    source_metadata: null,
    grading_confidence: 0.8,
    grading_metadata: null,
    lecturer_score: 76,
    lecturer_feedback: "Solid essay",
    final_score: 76,
    final_feedback: "Solid essay",
  },
});

describe("assignment detail builders", () => {
  beforeEach(() => {
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
    mocks.copyTextToClipboard.mockReset();
  });

  it("builds focus and header props with navigation handlers", async () => {
    const navigate = vi.fn();
    const setStatusFilter = vi.fn();
    const setSelected = vi.fn();
    const viewState = {
      assignmentNotificationFocusState: { title: "Notification focus" },
      isLecturer: true,
      moderationReleaseFocus: true,
      moderationReleaseHandoffState: { kind: "release-ready" },
      queueFocusState: { title: "Queue focus" },
      setStatusFilter,
      setSelected,
      summary: { total: 1 },
      workflowReadiness: { postureLabel: "Ready" },
    } as never;

    const focusProps = buildFocusStateProps({
      navigate,
      searchPathname: "/dashboard/assignment-1",
      viewState,
    });

    expect(focusProps.assignmentNotificationFocusState).toEqual(viewState.assignmentNotificationFocusState);
    expect(focusProps.isLecturer).toBe(true);
    focusProps.onClearQueueFocus();
    focusProps.onClearModerationFocus();
    focusProps.onClearNotificationFocus();
    expect(setStatusFilter).toHaveBeenCalledWith("all");
    expect(setSelected).toHaveBeenCalledWith(new Set());
    expect(navigate).toHaveBeenCalledWith("/dashboard/assignment-1", { replace: true });

    mocks.copyTextToClipboard.mockResolvedValue(true);
    await focusProps.onCopyModerationFocus();
    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith(buildAbsoluteAppUrl("/dashboard/assignment-1?source=moderation&focus=release-ready"));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Moderation handoff link copied."));

    mocks.copyTextToClipboard.mockResolvedValue(false);
    const failingFocusProps = buildFocusStateProps({
      navigate,
      searchPathname: "/dashboard/assignment-1",
      viewState,
    });
    await failingFocusProps.onCopyModerationFocus();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Could not copy the focus link."));

    const assignment = createAssignment();
    const heroProps = buildHeroCardProps({
      assignment,
      backHref: "/dashboard/assignments",
      navigate,
      viewState,
    });
    expect(heroProps.assignment).toBe(assignment);
    heroProps.onBack();
    expect(navigate).toHaveBeenCalledWith("/dashboard/assignments");

    expect(buildReadinessCardProps({ viewState }).workflowReadiness).toBe(viewState.workflowReadiness);
  });

  it("builds review, submission, and workflow action props with the expected delegates", async () => {
    const navigate = vi.fn();
    const reloadSubmissions = vi.fn().mockResolvedValue(undefined);
    const openReview = vi.fn();
    const startManualReview = vi.fn().mockResolvedValue(undefined);
    const approveSubmission = vi.fn();
    const releaseSubmission = vi.fn();
    const queueFeedbackSummary = vi.fn();
    const queueGradeReleaseNotification = vi.fn();
    const sendToModeration = vi.fn();
    const openReleasedResult = vi.fn();
    const setSearchQuery = vi.fn();
    const setStatusFilter = vi.fn();
    const exportReviewedReports = vi.fn();
    const handleAIGrade = vi.fn();
    const handleRetryFailedOnly = vi.fn();
    const handleReleaseGrades = vi.fn();
    const handleBulkApprove = vi.fn();
    const handlePlagiarismCheck = vi.fn();
    const handleBulkUpload = vi.fn();
    const handleStudentSubmit = vi.fn();
    const handleStartManualReviewForFailed = vi.fn();
    const fileActions = {
      fileInputRef: { current: null },
      bulkInputRef: { current: null },
      handleStudentSubmit,
      handleBulkUpload,
      uploading: false,
      uploadProgress: 0,
      openSubmissionFile: vi.fn(),
    };
    const automatedActions = {
      lastSubmissionRecoveryIssues: { "submission-1": { type: "missing_file" } },
      handlePlagiarismCheck,
      checkingPlagiarism: false,
      handleAIGrade,
      retryFailedOnly: handleRetryFailedOnly,
      grading: false,
      gradingElapsed: 0,
      gradingCount: 0,
      lastGradingRunSummary: null,
    };
    const lecturerActions = {
      openReview,
      startManualReview,
      approveSubmission,
      handleSingleRelease: releaseSubmission,
      queueFeedbackSummary,
      queueGradeReleaseNotification,
      sendToModeration,
      handleReleaseGrades,
      handleBulkApprove,
      startManualReviewForSubmissions: handleStartManualReviewForFailed,
    };
    const viewState = {
      isLecturer: true,
      studentSubmissionAvailability: { canSubmit: true },
      currentStudentSubmission: createSubmission(),
      openReleasedResult,
      workflowLaneSummary: { total: 1 },
      workflowReadiness: { postureLabel: "Ready" },
      selectedWorkflowGuidance: { label: "Guidance" },
      selectedWorkflowState: { label: "State" },
      selected: new Set(["submission-1"]),
      queueFocus: "released",
      queueFocusState: { statusFilter: "released", title: "Queue", description: "Queue desc" },
      searchQuery: "ada",
      setSearchQuery,
      setStatusFilter,
      exportReviewedReports,
      integrityRuntimeWarning: null,
      moderationReleaseHandoffState: { kind: "release-ready" },
    };

    const submissions = [createSubmission()];
    const moderationCases: Record<string, ModerationCase> = {};
    const assignment = createAssignment();
    const grades = createGrades();

    const reviewProps = buildReviewDialogProps({
      assignmentMaxScore: 100,
      grades,
      lecturerActions: {
        reviewGradeOverride: null,
        reviewSubmission: submissions[0],
        editFeedback: "Draft",
        editScore: "75",
        reviewOpen: true,
        setEditFeedback: vi.fn(),
        setEditScore: vi.fn(),
        setReviewOpen: vi.fn(),
        saveReview: vi.fn(),
      } as never,
    });
    expect(reviewProps.assignmentMaxScore).toBe(100);
    expect(reviewProps.grade).toEqual(grades["submission-1"]);

    const submissionListProps = buildSubmissionListProps({
      assignment,
      automatedActions: automatedActions as never,
      fileActions,
      grades,
      lecturerActions: lecturerActions as never,
      moderationCases,
      navigate,
      reloadSubmissions,
      searchPathname: "/dashboard/assignments/assignment-1",
      submissions,
      viewState: viewState as never,
    });
    expect(submissionListProps.submissions).toHaveLength(1);
    expect(submissionListProps.isLecturer).toBe(true);
    expect(submissionListProps.activeQueueFocus).toBe("released");
    submissionListProps.clearQueueFocus();
    submissionListProps.focusQueue("manual-review");
    expect(navigate).toHaveBeenCalledWith("/dashboard/assignments/assignment-1", { replace: true });
    expect(navigate).toHaveBeenCalledWith("/dashboard/assignments/assignment-1?source=queue&focus=manual-review", { replace: true });

    const workflowProps = buildWorkflowActionsProps({
      automatedActions: automatedActions as never,
      currentUserId: "lecturer-1",
      fileActions,
      lecturerActions: lecturerActions as never,
      submissions,
      submissionsCount: submissions.length,
      viewState: viewState as never,
    });
    expect(workflowProps.isLecturer).toBe(true);
    expect(workflowProps.selectedSize).toBe(1);
    workflowProps.handleStartManualReviewForFailed();
    expect(handleStartManualReviewForFailed).toHaveBeenCalledWith([]);

    const demoReviewProps = {
      ...reviewProps,
    };
    expect(demoReviewProps.reviewSubmission?.id).toBe("submission-1");
  });
});
