import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubmissionListSection } from "@/pages/dashboard/assignment-detail/ui/submission-list-section";
import type { SubmissionGradingRecoveryIssue } from "@/pages/dashboard/assignment-detail/workflows/automatedAssessmentShared";

const buildSubmission = (id: string, status: "submitted" | "under_review" | "approved" | "released" | "ai_grading" = "submitted") => ({
  id,
  assignment_id: "assignment-1",
  student_name: `Student ${id}`,
  student_email: `${id}@example.com`,
  file_name: "essay.pdf",
  file_type: "application/pdf",
  file_url: `https://example.com/${id}.pdf`,
  status,
  submitted_at: "2026-05-10T10:00:00.000Z",
  student_id: `${id}-student`,
});

function renderSection(recoveryIssue?: SubmissionGradingRecoveryIssue) {
  const submission = buildSubmission("submission-1");
  const toggleSelect = vi.fn();
  const startManualReview = vi.fn().mockResolvedValue(undefined);

  render(
    <SubmissionListSection
      submissions={[submission]}
      filteredSubmissions={[submission]}
      isLecturer
      selected={new Set<string>()}
      toggleAll={vi.fn()}
      toggleSelect={toggleSelect}
      grades={{}}
      moderationCases={{}}
      gradingRecoveryIssues={recoveryIssue ? { [submission.id]: recoveryIssue } : {}}
      assignment={{
        id: "assignment-1",
        title: "Essay",
        description: null,
        module_code: "CS401",
        max_score: 100,
        due_date: null,
        status: "published",
        lecturer_id: "lecturer-1",
        rubric: [],
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
      }}
      isDemo={false}
      openSubmissionFile={vi.fn().mockResolvedValue(undefined)}
      openModeration={vi.fn()}
      openReview={vi.fn()}
      startManualReview={startManualReview}
      approveSubmission={vi.fn().mockResolvedValue(false)}
      releaseSubmission={vi.fn().mockResolvedValue(undefined)}
      loadSubmissions={vi.fn().mockResolvedValue(undefined)}
      queueFeedbackSummary={vi.fn().mockResolvedValue(undefined)}
      queueGradeReleaseNotification={vi.fn().mockResolvedValue(undefined)}
      openReleasedResult={vi.fn()}
      moderationReleaseHandoffState={{
        kind: "empty",
        statusFilter: "approved",
        selectedSubmissionIds: [],
        title: "Opened from moderation release handoff",
        description: "No approved or released submissions currently match this older moderation handoff.",
      }}
      activeQueueFocus={null}
      focusQueue={vi.fn()}
      clearQueueFocus={vi.fn()}
    />,
  );

  return { toggleSelect, startManualReview };
}

describe("SubmissionListSection", () => {
  it("shows re-upload guidance for extraction failure", () => {
    renderSection({
      headline: "Readable file needed",
      detail: "GradeAI could not reliably extract text from this PDF. Continue with manual review or upload a DOCX copy while PDF support is being verified.",
      recoveryLabel: "Needs re-upload",
      type: "extraction_failure",
    });

    expect(screen.getByText("Try re-uploading as DOCX or a text-based PDF.")).toBeInTheDocument();
  });

  it("shows re-upload guidance for missing file", () => {
    renderSection({
      headline: "Readable file needed",
      detail: "No readable PDF, DOCX, TXT, or supported code file was attached, so this submission was skipped before grading.",
      recoveryLabel: "Needs re-upload",
      type: "missing_file",
    });

    expect(screen.getByText("Try re-uploading as DOCX or a text-based PDF.")).toBeInTheDocument();
  });

  it("does not show re-upload guidance for service failure and still allows retry selection", async () => {
    const { toggleSelect, startManualReview } = renderSection({
      headline: "Retry AI grading",
      detail: "OpenAI grading request timed out after 60000ms. Retry the submission or try again later.",
      recoveryLabel: "Select for retry",
      type: "service_failure",
    });

    expect(screen.getByText("Retry AI grading")).toBeInTheDocument();
    expect(
      screen.getByText("OpenAI grading request timed out after 60000ms. Retry the submission or try again later."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Try re-uploading as DOCX or a text-based PDF.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select for retry" }));
    expect(toggleSelect).toHaveBeenCalledWith("submission-1");

    fireEvent.click(screen.getByRole("button", { name: "Start manual review" }));
    expect(startManualReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: "submission-1" }),
    );
  });

  it("does not show re-upload guidance for status update failure", () => {
    renderSection({
      headline: "Retry AI grading",
      detail: "The submission could not be moved into AI grading. Refresh the page and retry or continue with manual follow-up.",
      recoveryLabel: "Select for retry",
      type: "service_failure",
    });

    expect(screen.queryByText("Try re-uploading as DOCX or a text-based PDF.")).not.toBeInTheDocument();
  });

  it("does not show re-upload guidance for invalid grading results", () => {
    renderSection({
      headline: "Incomplete grading result",
      detail: "The grading output could not be validated, so this submission stayed in its previous workflow state.",
      recoveryLabel: "Select for retry",
      type: "invalid_result",
    });

    expect(screen.queryByText("Try re-uploading as DOCX or a text-based PDF.")).not.toBeInTheDocument();
  });

  it("lets lecturers return from the focused manual-review queue", () => {
    const clearQueueFocus = vi.fn();
    const submission = buildSubmission("submission-2", "under_review");

    render(
      <SubmissionListSection
        submissions={[submission]}
        filteredSubmissions={[submission]}
        isLecturer
        selected={new Set<string>()}
        toggleAll={vi.fn()}
        toggleSelect={vi.fn()}
        grades={{}}
        moderationCases={{}}
        gradingRecoveryIssues={{}}
        assignment={{
          id: "assignment-1",
          title: "Essay",
          description: null,
          module_code: "CS401",
          max_score: 100,
          due_date: null,
          status: "published",
          lecturer_id: "lecturer-1",
          rubric: [],
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z",
        }}
        isDemo={false}
        openSubmissionFile={vi.fn().mockResolvedValue(undefined)}
        openModeration={vi.fn()}
        openReview={vi.fn()}
        startManualReview={vi.fn().mockResolvedValue(undefined)}
        approveSubmission={vi.fn().mockResolvedValue(false)}
        releaseSubmission={vi.fn().mockResolvedValue(undefined)}
        loadSubmissions={vi.fn().mockResolvedValue(undefined)}
        queueFeedbackSummary={vi.fn().mockResolvedValue(undefined)}
        queueGradeReleaseNotification={vi.fn().mockResolvedValue(undefined)}
        openReleasedResult={vi.fn()}
        moderationReleaseHandoffState={{
          kind: "empty",
          statusFilter: "approved",
          selectedSubmissionIds: [],
          title: "Opened from moderation release handoff",
          description: "No approved or released submissions currently match this older moderation handoff.",
        }}
        activeQueueFocus="manual-review"
        focusQueue={vi.fn()}
        clearQueueFocus={clearQueueFocus}
      />,
    );

    expect(screen.getByRole("button", { name: "Return to full queue" })).toBeInTheDocument();
    expect(screen.getByText("1 manual-review submission visible in the current queue.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to full queue" }));
    expect(clearQueueFocus).toHaveBeenCalled();
  });

  it("surfaces a release-ready handoff queue and focuses approved submissions", () => {
    const focusQueue = vi.fn();
    const submission = buildSubmission("submission-3", "approved");

    render(
      <SubmissionListSection
        submissions={[submission]}
        filteredSubmissions={[submission]}
        isLecturer
        selected={new Set<string>()}
        toggleAll={vi.fn()}
        toggleSelect={vi.fn()}
        grades={{}}
        moderationCases={{}}
        gradingRecoveryIssues={{}}
        assignment={{
          id: "assignment-1",
          title: "Essay",
          description: null,
          module_code: "CS401",
          max_score: 100,
          due_date: null,
          status: "published",
          lecturer_id: "lecturer-1",
          rubric: [],
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z",
        }}
        isDemo={false}
        openSubmissionFile={vi.fn().mockResolvedValue(undefined)}
        openModeration={vi.fn()}
        openReview={vi.fn()}
        startManualReview={vi.fn().mockResolvedValue(undefined)}
        approveSubmission={vi.fn().mockResolvedValue(false)}
        releaseSubmission={vi.fn().mockResolvedValue(undefined)}
        loadSubmissions={vi.fn().mockResolvedValue(undefined)}
        queueFeedbackSummary={vi.fn().mockResolvedValue(undefined)}
        queueGradeReleaseNotification={vi.fn().mockResolvedValue(undefined)}
        openReleasedResult={vi.fn()}
        moderationReleaseHandoffState={{
          kind: "release-ready",
          statusFilter: "approved",
          selectedSubmissionIds: ["submission-3"],
          title: "Opened from moderation release handoff",
          description: "Approved submissions are ready for release after moderation.",
        }}
        activeQueueFocus={null}
        focusQueue={focusQueue}
        clearQueueFocus={vi.fn()}
      />,
    );

    expect(screen.getByText("Release-ready queue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Focus release-ready queue" }));
    expect(focusQueue).toHaveBeenCalledWith("release-ready");
  });

  it("keeps actively grading submissions visible with an explicit loading state", () => {
    const submission = buildSubmission("submission-4", "ai_grading");

    render(
      <SubmissionListSection
        submissions={[submission]}
        filteredSubmissions={[submission]}
        isLecturer
        selected={new Set<string>()}
        toggleAll={vi.fn()}
        toggleSelect={vi.fn()}
        grades={{}}
        moderationCases={{}}
        gradingRecoveryIssues={{}}
        assignment={{
          id: "assignment-1",
          title: "Essay",
          description: null,
          module_code: "CS401",
          max_score: 100,
          due_date: null,
          status: "published",
          lecturer_id: "lecturer-1",
          rubric: [],
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z",
        }}
        isDemo={false}
        openSubmissionFile={vi.fn().mockResolvedValue(undefined)}
        openModeration={vi.fn()}
        openReview={vi.fn()}
        startManualReview={vi.fn().mockResolvedValue(undefined)}
        approveSubmission={vi.fn().mockResolvedValue(false)}
        releaseSubmission={vi.fn().mockResolvedValue(undefined)}
        loadSubmissions={vi.fn().mockResolvedValue(undefined)}
        queueFeedbackSummary={vi.fn().mockResolvedValue(undefined)}
        queueGradeReleaseNotification={vi.fn().mockResolvedValue(undefined)}
        openReleasedResult={vi.fn()}
        moderationReleaseHandoffState={{
          kind: "empty",
          statusFilter: "approved",
          selectedSubmissionIds: [],
          title: "Opened from moderation release handoff",
          description: "No approved or released submissions currently match this older moderation handoff.",
        }}
        activeQueueFocus={null}
        focusQueue={vi.fn()}
        clearQueueFocus={vi.fn()}
      />,
    );

    expect(screen.getByText("AI grading in progress. Keep this page open while the workflow runs.")).toBeInTheDocument();
  });
});
