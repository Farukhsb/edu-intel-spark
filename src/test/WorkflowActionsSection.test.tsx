import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowActionsSection } from "@/pages/dashboard/assignment-detail/ui/workflow-actions-section";

describe("WorkflowActionsSection", () => {
  it("surfaces the last grading run with recovery guidance for lecturers", () => {
    const retryFailedOnly = vi.fn();
    const startManualReviewForFailed = vi.fn();

    render(
      <WorkflowActionsSection
        isDemo={false}
        isLecturer
        submissionFileAccept=".pdf,.docx,.txt"
        fileInputRef={createRef<HTMLInputElement>()}
        bulkInputRef={createRef<HTMLInputElement>()}
        handleStudentSubmit={vi.fn()}
        studentSubmissionAvailability={{
          canSubmit: false,
          ctaLabel: "Unavailable",
          helperText: "Not used in lecturer mode",
        }}
        uploading={false}
        uploadProgress={0}
        currentUserId="lecturer-1"
        handleBulkUpload={vi.fn()}
        handlePlagiarismCheck={vi.fn()}
        checkingPlagiarism={false}
        integrityRuntimeWarning={null}
        submissionsCount={4}
        handleAIGrade={vi.fn()}
        handleRetryFailedOnly={retryFailedOnly}
        workflowLaneSummary={{
          intakeCount: 2,
          aiInProgressCount: 0,
          firstReviewCount: 1,
          manualReviewCount: 1,
          moderationCount: 0,
          releaseReadyCount: 0,
          releasedCount: 0,
        }}
        workflowReadiness={{
          manualReviewCount: 1,
          postureLabel: "Active review position",
          likelyChallenge: "One submission still needs grading recovery",
          bestNextAction: "Clear the failed grading work before the release queue grows",
        }}
        selectedWorkflowGuidance={{
          headline: "First-review work is selected",
          detail: "Review the draft output and recover any failed grading cases.",
        }}
        selectedWorkflowState={{
          submittedCount: 1,
          regradableCount: 1,
          approvableCount: 0,
          releaseReadyCount: 0,
          hasRegradable: true,
          hasApprovable: false,
          hasReleaseReady: false,
        }}
        grading={false}
        selectedSize={1}
        handleReleaseGrades={vi.fn()}
        handleBulkApprove={vi.fn()}
        currentStudentSubmission={null}
        openReleasedResult={vi.fn()}
        searchQuery=""
        setSearchQuery={vi.fn()}
        statusFilter="all"
        setStatusFilter={vi.fn()}
        exportReviewedReports={vi.fn()}
        gradingElapsed={0}
        gradingCount={0}
        handleStartManualReviewForFailed={startManualReviewForFailed}
        lastGradingRunSummary={{
          attemptedCount: 3,
          detail:
            "1 selected submission was skipped before grading because no readable PDF, DOCX, TXT, or supported code file was attached. 1 submission could not be read by the grading service.",
          extractionFailureCount: 1,
          failedCount: 1,
          headline: "2 of 4 selected submissions still need attention",
          invalidResultCount: 0,
          recoveryActions: [
            "Ask the student to upload a readable PDF, DOCX, TXT, or supported code file.",
            "Retry AI grading after confirming the uploaded files open correctly.",
            "Continue with manual review if the retry still fails so release work does not stall.",
          ],
          serviceFailureCount: 0,
          skippedCount: 1,
          successCount: 2,
        }}
      />,
    );

    expect(screen.getByText("2 of 4 selected submissions still need attention")).toBeInTheDocument();
    expect(
      screen.getByText(
        "PDFs must contain selectable text. Scanned/image-only PDFs may not be readable by AI grading. If unsure, upload DOCX instead.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/skipped before grading/i)).toBeInTheDocument();
    expect(screen.getByText("2 graded")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("1 skipped")).toBeInTheDocument();
    expect(screen.getByText("Manual review")).toBeInTheDocument();
    expect(screen.getByText("1 manual review open")).toBeInTheDocument();
    expect(screen.getByText(/Continue with manual review if the retry still fails/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry failed only" }));
    expect(retryFailedOnly).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Start manual review" }));
    expect(startManualReviewForFailed).toHaveBeenCalledTimes(1);
  });
});
