import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubmissionListSection } from "@/pages/dashboard/assignment-detail/ui/submission-list-section";

describe("SubmissionListSection", () => {
  it("shows per-submission grading recovery guidance and allows retry selection", async () => {
    const toggleSelect = vi.fn();
    const startManualReview = vi.fn().mockResolvedValue(undefined);
    const focusQueue = vi.fn();

    render(
      <SubmissionListSection
        submissions={[
          {
            id: "submission-1",
            assignment_id: "assignment-1",
            student_name: "Amina Hassan",
            student_email: "amina@example.com",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/essay.pdf",
            status: "submitted",
            submitted_at: "2026-05-10T10:00:00.000Z",
            student_id: "student-1",
          },
          {
            id: "submission-2",
            assignment_id: "assignment-1",
            student_name: "Kwame Mensah",
            student_email: "kwame@example.com",
            file_name: "report.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/report.pdf",
            status: "under_review",
            submitted_at: "2026-05-10T10:10:00.000Z",
            student_id: "student-2",
          },
        ]}
        filteredSubmissions={[
          {
            id: "submission-1",
            assignment_id: "assignment-1",
            student_name: "Amina Hassan",
            student_email: "amina@example.com",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/essay.pdf",
            status: "submitted",
            submitted_at: "2026-05-10T10:00:00.000Z",
            student_id: "student-1",
          },
          {
            id: "submission-2",
            assignment_id: "assignment-1",
            student_name: "Kwame Mensah",
            student_email: "kwame@example.com",
            file_name: "report.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/report.pdf",
            status: "under_review",
            submitted_at: "2026-05-10T10:10:00.000Z",
            student_id: "student-2",
          },
        ]}
        isLecturer
        selected={new Set<string>()}
        toggleAll={vi.fn()}
        toggleSelect={toggleSelect}
        grades={{}}
        moderationCases={{}}
        gradingRecoveryIssues={{
          "submission-1": {
            headline: "Retry AI grading",
            detail: "The grading service did not complete cleanly for this submission.",
            recoveryLabel: "Select for retry",
            type: "service_failure",
          },
        }}
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
        focusQueue={focusQueue}
        clearQueueFocus={vi.fn()}
      />,
    );

    expect(screen.getByTestId("manual-review-queue-banner")).toBeInTheDocument();
    expect(screen.getByText("Manual review queue")).toBeInTheDocument();

    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("Retry AI grading")).toBeInTheDocument();
    expect(screen.getByText("The grading service did not complete cleanly for this submission.")).toBeInTheDocument();
    expect(screen.getByText("Try re-uploading as DOCX or a text-based PDF.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Focus manual review queue" }));
    expect(focusQueue).toHaveBeenCalledWith("manual-review");

    fireEvent.click(screen.getByRole("button", { name: "Select for retry" }));
    expect(toggleSelect).toHaveBeenCalledWith("submission-1");

    fireEvent.click(screen.getByRole("button", { name: "Start manual review" }));
    expect(startManualReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: "submission-1" }),
    );
  });

  it("lets lecturers return from the focused manual-review queue", () => {
    const clearQueueFocus = vi.fn();

    render(
      <SubmissionListSection
        submissions={[
          {
            id: "submission-2",
            assignment_id: "assignment-1",
            student_name: "Kwame Mensah",
            student_email: "kwame@example.com",
            file_name: "report.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/report.pdf",
            status: "under_review",
            submitted_at: "2026-05-10T10:10:00.000Z",
            student_id: "student-2",
          },
        ]}
        filteredSubmissions={[
          {
            id: "submission-2",
            assignment_id: "assignment-1",
            student_name: "Kwame Mensah",
            student_email: "kwame@example.com",
            file_name: "report.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/report.pdf",
            status: "under_review",
            submitted_at: "2026-05-10T10:10:00.000Z",
            student_id: "student-2",
          },
        ]}
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

    render(
      <SubmissionListSection
        submissions={[
          {
            id: "submission-3",
            assignment_id: "assignment-1",
            student_name: "Sarah Cole",
            student_email: "sarah@example.com",
            file_name: "moderated.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/moderated.pdf",
            status: "approved",
            submitted_at: "2026-05-10T10:20:00.000Z",
            student_id: "student-3",
          },
        ]}
        filteredSubmissions={[
          {
            id: "submission-3",
            assignment_id: "assignment-1",
            student_name: "Sarah Cole",
            student_email: "sarah@example.com",
            file_name: "moderated.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/moderated.pdf",
            status: "approved",
            submitted_at: "2026-05-10T10:20:00.000Z",
            student_id: "student-3",
          },
        ]}
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
          description: "The submission list is focused on approved work that is ready to release to students.",
        }}
        activeQueueFocus={null}
        focusQueue={focusQueue}
        clearQueueFocus={vi.fn()}
      />,
    );

    expect(screen.getByTestId("moderation-release-queue-banner")).toBeInTheDocument();
    expect(screen.getByText("Release-ready queue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Focus release-ready queue" }));
    expect(focusQueue).toHaveBeenCalledWith("release-ready");
  });

  it("surfaces a released-results queue after the moderation handoff is already complete", () => {
    render(
      <SubmissionListSection
        submissions={[
          {
            id: "submission-4",
            assignment_id: "assignment-1",
            student_name: "David Ofori",
            student_email: "david@example.com",
            file_name: "released.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/released.pdf",
            status: "released",
            submitted_at: "2026-05-10T10:30:00.000Z",
            student_id: "student-4",
          },
        ]}
        filteredSubmissions={[
          {
            id: "submission-4",
            assignment_id: "assignment-1",
            student_name: "David Ofori",
            student_email: "david@example.com",
            file_name: "released.pdf",
            file_type: "application/pdf",
            file_url: "https://example.com/released.pdf",
            status: "released",
            submitted_at: "2026-05-10T10:30:00.000Z",
            student_id: "student-4",
          },
        ]}
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
          kind: "released",
          statusFilter: "released",
          selectedSubmissionIds: ["submission-4"],
          title: "Opened from moderation handoff after release",
          description: "The earlier moderation handoff has already completed, so the list is focused on submissions that were released to students.",
        }}
        activeQueueFocus="released-results"
        focusQueue={vi.fn()}
        clearQueueFocus={vi.fn()}
      />,
    );

    expect(screen.getByText("Released results queue")).toBeInTheDocument();
    expect(screen.getByText("1 submission visible in the current released-results queue.")).toBeInTheDocument();
  });
});
