import { CheckCheck, Clock, Edit, FileText, Loader2, Send, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getSubmissionDisplayState } from "@/lib/assessmentWorkflow";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";
import type { AssignmentQueueFocusValue } from "@/lib/schemas/navigation";
import type { ModerationReleaseHandoffState } from "@/pages/dashboard/assignment-detail/domain";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailBreakdown,
  AssignmentDetailSubmission,
  Grade,
  ModerationCase,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";
import type { SubmissionGradingRecoveryIssue } from "@/pages/dashboard/assignment-detail/workflows/useAutomatedAssessmentActions";

const statusConfig: Record<
  SubmissionStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]>; icon: LucideIcon; tone: string }
> = {
  submitted: {
    label: "Submitted",
    variant: "outline",
    icon: Clock,
    tone: "border-border text-muted-foreground",
  },
  ai_grading: {
    label: "AI Grading",
    variant: "secondary",
    icon: Sparkles,
    tone: "border-primary/20 text-primary",
  },
  ai_graded: {
    label: "AI Graded",
    variant: "secondary",
    icon: Sparkles,
    tone: "border-primary/20 text-primary",
  },
  first_review: {
    label: "First Review",
    variant: "outline",
    icon: Edit,
    tone: "border-warning/30 text-warning",
  },
  moderation_pending: {
    label: "Moderation Pending",
    variant: "outline",
    icon: Shield,
    tone: "border-warning/30 text-warning",
  },
  moderation_in_progress: {
    label: "Moderation In Progress",
    variant: "outline",
    icon: Shield,
    tone: "border-warning/30 text-warning",
  },
  moderated: {
    label: "Moderated",
    variant: "outline",
    icon: Shield,
    tone: "border-primary/20 text-primary",
  },
  escalated: {
    label: "Escalated",
    variant: "destructive",
    icon: Shield,
    tone: "border-destructive/30 text-destructive",
  },
  under_review: {
    label: "Under Review",
    variant: "outline",
    icon: Edit,
    tone: "border-warning/30 text-warning",
  },
  approved: {
    label: "Approved",
    variant: "default",
    icon: CheckCheck,
    tone: "border-success/30 text-success",
  },
  released: {
    label: "Released",
    variant: "default",
    icon: Send,
    tone: "border-success/30 text-success",
  },
};

const SubmissionCardItem = ({
  submission,
  assignment,
  grade,
  moderationCase,
  isLecturer,
  isDemo,
  isSelected,
  toggleSelect,
  openSubmissionFile,
  openModeration,
  openReview,
  startManualReview,
  approveSubmission,
  releaseSubmission,
  loadSubmissions,
  queueFeedbackSummary,
  queueGradeReleaseNotification,
  openReleasedResult,
  gradingRecoveryIssue,
}: {
  submission: AssignmentDetailSubmission;
  assignment: AssignmentDetailAssignment;
  grade: Grade | undefined;
  moderationCase: ModerationCase | undefined;
  isLecturer: boolean;
  isDemo: boolean;
  isSelected: boolean;
  toggleSelect: (submissionId: string) => void;
  openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  openModeration: () => void;
  openReview: (submission: AssignmentDetailSubmission) => void;
  startManualReview: (submission: AssignmentDetailSubmission) => Promise<void>;
  approveSubmission: (submission: AssignmentDetailSubmission) => Promise<boolean>;
  releaseSubmission: (submission: AssignmentDetailSubmission) => Promise<void>;
  loadSubmissions: () => Promise<void>;
  queueFeedbackSummary: (submission: AssignmentDetailSubmission) => Promise<void>;
  queueGradeReleaseNotification: (submission: AssignmentDetailSubmission) => Promise<void>;
  openReleasedResult: (submission: AssignmentDetailSubmission) => void;
  gradingRecoveryIssue?: SubmissionGradingRecoveryIssue;
}) => {
  const submissionDisplay = getSubmissionDisplayState({
    status: submission.status,
    grade,
    moderationCase,
    isLecturer,
  });
  const sc = statusConfig[submission.status];
  const StatusIcon = sc.icon;
  const needsAttention = [
    "submitted",
    "ai_grading",
    "ai_graded",
    "first_review",
    "moderation_pending",
    "moderation_in_progress",
    "escalated",
    "under_review",
  ].includes(submission.status);

  return (
    <div
      data-testid={`submission-card-${submission.id}`}
      className="rounded-2xl border p-4 shadow-sm transition-colors hover:bg-muted/20"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          {isLecturer && (
            <div className="pt-1">
              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(submission.id)} />
            </div>
          )}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/70">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium truncate">{submission.student_name || submission.student_email || "Student"}</p>
              {needsAttention && (
                <Badge variant="outline" className="border-warning/30 text-warning text-[10px] uppercase tracking-wide">
                  Needs attention
                </Badge>
              )}
              {moderationCase && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Moderation case
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{submission.file_name}</p>
            <p className="text-xs text-muted-foreground">
              Submitted {safeFormatDate(submission.submitted_at, "MMM d, yyyy 'at' HH:mm")}
            </p>
            {submission.status === "ai_grading" && (
              <div className="flex items-center gap-2 pt-1 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>AI grading in progress. Keep this page open while the workflow runs.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => void openSubmissionFile(submission)}
              >
                Open file
              </Button>
              {moderationCase && (
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={openModeration}
                >
                  Open moderation
                </Button>
              )}
              {gradingRecoveryIssue && gradingRecoveryIssue.type !== "missing_file" && isLecturer && (
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => toggleSelect(submission.id)}
                >
                  {gradingRecoveryIssue.recoveryLabel}
                </Button>
              )}
              {gradingRecoveryIssue && isLecturer && (
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => void startManualReview(submission)}
                >
                  Start manual review
                </Button>
              )}
            </div>

            {gradingRecoveryIssue && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-amber-300 text-[10px] uppercase tracking-wide text-amber-800">
                    Recovery
                  </Badge>
                  <p className="text-xs font-medium text-amber-950">{gradingRecoveryIssue.headline}</p>
                </div>
                <p className="mt-2 text-xs text-amber-900">{gradingRecoveryIssue.detail}</p>
                <p className="mt-2 text-xs text-amber-800">
                  Try re-uploading as DOCX or a text-based PDF.
                </p>
              </div>
            )}

            {(grade?.ai_breakdown?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(grade?.ai_breakdown ?? []).map((breakdown: AssignmentDetailBreakdown, index: number) => (
                  <span key={index} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                    {breakdown.criterion}: {breakdown.score}/{breakdown.max_score}
                    {typeof breakdown.confidence_score === "number"
                      ? ` - c${Math.round(breakdown.confidence_score * 100)}%`
                      : ""}
                  </span>
                ))}
              </div>
            )}

            {!isLecturer && submissionDisplay.studentVisibleFeedback && (
              <p className="pt-1 text-xs text-muted-foreground line-clamp-2">{submissionDisplay.studentVisibleFeedback}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {submissionDisplay.scoreToDisplay != null && (
              <span className="text-sm font-bold font-display">
                {submissionDisplay.scoreToDisplay}/{assignment.max_score}
              </span>
            )}
            {grade?.assignment_type && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {grade.assignment_type}
              </Badge>
            )}
            <Badge
              data-testid={`submission-status-${submission.id}`}
              variant={sc.variant}
              className={`text-xs ${sc.tone}`}
            >
              <StatusIcon className="mr-1 h-3 w-3" />
              {sc.label}
            </Badge>
          </div>

          {isLecturer && (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {submissionDisplay.showFeedbackSummary && (
                <Button size="sm" variant="ghost" disabled={isDemo} onClick={() => void queueFeedbackSummary(submission)}>
                  <Sparkles className="mr-1 h-3 w-3" /> Feedback summary
                </Button>
              )}
              {submissionDisplay.showFirstReview && (
                <Button
                  data-testid={`submission-review-${submission.id}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => openReview(submission)}
                >
                  <Edit className="mr-1 h-3 w-3" /> First review
                </Button>
              )}
              {submissionDisplay.showApprove && (
                <Button
                  data-testid={`submission-approve-${submission.id}`}
                  size="sm"
                  variant="outline"
                  disabled={isDemo}
                  onClick={async () => {
                    try {
                      const approved = await approveSubmission(submission);
                      if (approved) toast.success("Submission approved");
                      await loadSubmissions();
                    } catch {
                      log.warn("Submission approve failed", {
                        submissionId: submission.id,
                      });
                      toast.error("Could not approve");
                    }
                  }}
                >
                  <CheckCheck className="mr-1 h-3 w-3" /> Approve
                </Button>
              )}
              {submissionDisplay.showRelease && (
                <Button
                  data-testid={`submission-release-${submission.id}`}
                  size="sm"
                  variant="default"
                  disabled={isDemo}
                  onClick={async () => {
                    try {
                      await releaseSubmission(submission);
                      await loadSubmissions();
                    } catch {
                      toast.error("Failed to release grade");
                    }
                  }}
                >
                  <Send className="mr-1 h-3 w-3" /> Release
                </Button>
              )}
              {submissionDisplay.showReleaseNote && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isDemo}
                  onClick={() => void queueGradeReleaseNotification(submission)}
                >
                  <Send className="mr-1 h-3 w-3" /> Send release note
                </Button>
              )}
            </div>
          )}
          {!isLecturer && submission.status === "released" && (
            <Button size="sm" onClick={() => openReleasedResult(submission)}>
              Open Released Result
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const SubmissionListSection = ({
  submissions,
  filteredSubmissions,
  isLecturer,
  selected,
  toggleAll,
  toggleSelect,
  grades,
  moderationCases,
  assignment,
  isDemo,
  gradingRecoveryIssues,
  openSubmissionFile,
  openModeration,
  openReview,
  startManualReview,
  approveSubmission,
  releaseSubmission,
  loadSubmissions,
  queueFeedbackSummary,
  queueGradeReleaseNotification,
  openReleasedResult,
  moderationReleaseHandoffState,
  activeQueueFocus,
  focusQueue,
  clearQueueFocus,
}: {
  submissions: AssignmentDetailSubmission[];
  filteredSubmissions: AssignmentDetailSubmission[];
  isLecturer: boolean;
  selected: Set<string>;
  toggleAll: () => void;
  toggleSelect: (submissionId: string) => void;
  grades: Record<string, Grade>;
  moderationCases: Record<string, ModerationCase>;
  assignment: AssignmentDetailAssignment;
  isDemo: boolean;
  gradingRecoveryIssues: Record<string, SubmissionGradingRecoveryIssue>;
  openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  openModeration: () => void;
  openReview: (submission: AssignmentDetailSubmission) => void;
  startManualReview: (submission: AssignmentDetailSubmission) => Promise<void>;
  approveSubmission: (submission: AssignmentDetailSubmission) => Promise<boolean>;
  releaseSubmission: (submission: AssignmentDetailSubmission) => Promise<void>;
  loadSubmissions: () => Promise<void>;
  queueFeedbackSummary: (submission: AssignmentDetailSubmission) => Promise<void>;
  queueGradeReleaseNotification: (submission: AssignmentDetailSubmission) => Promise<void>;
  openReleasedResult: (submission: AssignmentDetailSubmission) => void;
  moderationReleaseHandoffState: ModerationReleaseHandoffState;
  activeQueueFocus: AssignmentQueueFocusValue | null;
  focusQueue: (focus: AssignmentQueueFocusValue) => void;
  clearQueueFocus: () => void;
}) => {
  const manualReviewSubmissions = submissions.filter((submission) => submission.status === "under_review");
  const visibleManualReviewCount = filteredSubmissions.filter(
    (submission) => submission.status === "under_review",
  ).length;
  const showingManualReviewQueue = activeQueueFocus === "manual-review";
  const releaseReadySubmissions = submissions.filter((submission) => submission.status === "approved");
  const releasedSubmissions = submissions.filter((submission) => submission.status === "released");
  const handoffFocusStatus = moderationReleaseHandoffState.statusFilter;
  const showingHandoffQueue =
    (activeQueueFocus === "release-ready" && handoffFocusStatus === "approved") ||
    (activeQueueFocus === "released-results" && handoffFocusStatus === "released");
  const visibleHandoffCount = filteredSubmissions.filter(
    (submission) => submission.status === handoffFocusStatus,
  ).length;
  const shouldShowReleaseHandoffBanner =
    releaseReadySubmissions.length > 0 || releasedSubmissions.length > 0;
  const releaseHandoffTitle =
    moderationReleaseHandoffState.kind === "released"
      ? "Released results queue"
      : "Release-ready queue";
  const releaseHandoffDetail =
    moderationReleaseHandoffState.kind === "released"
      ? `${releasedSubmissions.length} submission${releasedSubmissions.length === 1 ? "" : "s"} already moved through moderation and have been released to students.`
      : `${releaseReadySubmissions.length} approved submission${releaseReadySubmissions.length === 1 ? "" : "s"} still need final release to students.`;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Submissions</CardTitle>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No submissions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Student uploads will appear here once work is submitted to this assignment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {isLecturer && manualReviewSubmissions.length > 0 && (
              <div
                data-testid="manual-review-queue-banner"
                className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Manual review queue</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {manualReviewSubmissions.length} submission
                      {manualReviewSubmissions.length === 1 ? "" : "s"} bypassed AI grading and still need a lecturer-owned score and feedback.
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {showingManualReviewQueue
                        ? `${visibleManualReviewCount} manual-review submission${visibleManualReviewCount === 1 ? "" : "s"} visible in the current queue.`
                        : "Focus this queue to clear manual fallbacks before they become a release bottleneck."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={showingManualReviewQueue ? "outline" : "default"}
                      onClick={() =>
                        showingManualReviewQueue
                          ? clearQueueFocus()
                          : focusQueue("manual-review")
                      }
                    >
                      {showingManualReviewQueue ? "Return to full queue" : "Focus manual review queue"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {isLecturer && shouldShowReleaseHandoffBanner && (
              <div
                data-testid="moderation-release-queue-banner"
                className="rounded-xl border border-sky-300/60 bg-sky-50/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{releaseHandoffTitle}</p>
                    <p className="mt-1 text-sm text-slate-700">{releaseHandoffDetail}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      {showingHandoffQueue
                        ? `${visibleHandoffCount} submission${visibleHandoffCount === 1 ? "" : "s"} visible in the current ${moderationReleaseHandoffState.kind === "released" ? "released-results" : "release-ready"} queue.`
                        : moderationReleaseHandoffState.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={showingHandoffQueue ? "outline" : "default"}
                      onClick={() =>
                        showingHandoffQueue
                          ? clearQueueFocus()
                          : focusQueue(
                              moderationReleaseHandoffState.kind === "released"
                                ? "released-results"
                                : "release-ready",
                            )
                      }
                    >
                      {showingHandoffQueue
                        ? "Return to full queue"
                        : moderationReleaseHandoffState.kind === "released"
                          ? "Focus released results"
                          : "Focus release-ready queue"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isLecturer && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <Checkbox
                  checked={selected.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">Select all visible submissions</span>
              </div>
            )}

            {filteredSubmissions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No submissions match this view</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adjust the status filter or search query to see more work.
                </p>
              </div>
            ) : filteredSubmissions.map((submission) => (
              <SubmissionCardItem
                key={submission.id}
                submission={submission}
                assignment={assignment}
                grade={grades[submission.id]}
                gradingRecoveryIssue={gradingRecoveryIssues[submission.id]}
                moderationCase={moderationCases[submission.id]}
                isLecturer={isLecturer}
                isDemo={isDemo}
                isSelected={selected.has(submission.id)}
                toggleSelect={toggleSelect}
                openSubmissionFile={openSubmissionFile}
                openModeration={openModeration}
                openReview={openReview}
                startManualReview={startManualReview}
                approveSubmission={approveSubmission}
                releaseSubmission={releaseSubmission}
                loadSubmissions={loadSubmissions}
                queueFeedbackSummary={queueFeedbackSummary}
                queueGradeReleaseNotification={queueGradeReleaseNotification}
                openReleasedResult={openReleasedResult}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
