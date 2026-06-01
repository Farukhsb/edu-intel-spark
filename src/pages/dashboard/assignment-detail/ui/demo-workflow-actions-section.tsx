import type { ChangeEvent, RefObject } from "react";
import {
  Brain,
  CheckCheck,
  Loader2,
  Search,
  Send,
  Shield,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { safeFormatDate } from "@/lib/date";
import { getStudentSubmissionAvailability } from "@/lib/assignmentVisibility";
import { getSelectedWorkflowActionState } from "@/lib/assessmentWorkflow";
import type { LecturerSelectionGuidance, LecturerWorkflowLaneSummary } from "@/lib/assessmentWorkflow";
import type { WorkflowReadinessState } from "@/pages/dashboard/assignment-detail/domain";
import type {
  AssignmentDetailSubmission,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";

type WorkflowActionState = ReturnType<typeof getSelectedWorkflowActionState>;
type StudentSubmissionAvailability = ReturnType<typeof getStudentSubmissionAvailability>;

const getStudentWorkflowJourney = (status: SubmissionStatus | null) => {
  if (!status) {
    return {
      badge: "Ready",
      title: "Ready to submit",
      description: "Upload your work once to enter the grading and review workflow.",
    };
  }

  if (status === "released") {
    return {
      badge: "Released",
      title: "Released result available",
      description: "Your final result has been released. You can now review the feedback and explanation.",
    };
  }

  if (status === "approved") {
    return {
      badge: "Approved",
      title: "Awaiting release",
      description: "Your submission has been approved and is waiting for final release to students.",
    };
  }

  if (status === "moderation_pending" || status === "moderation_in_progress" || status === "escalated") {
    return {
      badge: "Moderation",
      title: "Under moderation",
      description: "Your submission is still moving through the moderation workflow before a final result can be released.",
    };
  }

  if (status === "ai_graded" || status === "first_review" || status === "moderated" || status === "under_review") {
    return {
      badge: "Review",
      title: "Awaiting final review",
      description: "Marking is in progress and the released result is not available yet.",
    };
  }

  return {
    badge: "Submitted",
    title: "Submission received",
    description: "Your file has been received and is now progressing through the assessment workflow.",
  };
};

export const WorkflowActionsSection = ({
  isLecturer,
  submissionFileAccept,
  fileInputRef,
  bulkInputRef,
  handleStudentSubmit,
  studentSubmissionAvailability,
  uploading,
  uploadProgress,
  currentUserId,
  handleBulkUpload,
  handlePlagiarismCheck,
  checkingPlagiarism,
  integrityRuntimeWarning,
  submissionsCount,
  handleAIGrade,
  handleRetryFailedOnly,
  workflowLaneSummary,
  workflowReadiness,
  selectedWorkflowGuidance,
  selectedWorkflowState,
  grading,
  selectedSize,
  handleReleaseGrades,
  handleBulkApprove,
  currentStudentSubmission,
  openReleasedResult,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  exportReviewedReports,
  gradingElapsed,
  gradingCount,
  handleStartManualReviewForFailed,
  lastGradingRunSummary,
}: {
  isLecturer: boolean;
  submissionFileAccept: string;
  fileInputRef: RefObject<HTMLInputElement>;
  bulkInputRef: RefObject<HTMLInputElement>;
  handleStudentSubmit: (event: ChangeEvent<HTMLInputElement>) => void;
  studentSubmissionAvailability: StudentSubmissionAvailability;
  uploading: boolean;
  uploadProgress: number;
  currentUserId: string | null;
  handleBulkUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  handlePlagiarismCheck: () => void;
  checkingPlagiarism: boolean;
  integrityRuntimeWarning: string | null;
  submissionsCount: number;
  handleAIGrade: () => void;
  handleRetryFailedOnly: () => void;
  workflowLaneSummary: LecturerWorkflowLaneSummary;
  workflowReadiness: WorkflowReadinessState;
  selectedWorkflowGuidance: LecturerSelectionGuidance;
  selectedWorkflowState: WorkflowActionState;
  grading: boolean;
  selectedSize: number;
  handleReleaseGrades: () => void;
  handleBulkApprove: () => void;
  currentStudentSubmission: AssignmentDetailSubmission | null;
  openReleasedResult: (submission: AssignmentDetailSubmission) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: "all" | SubmissionStatus;
  setStatusFilter: (value: "all" | SubmissionStatus) => void;
  exportReviewedReports: () => void;
  gradingElapsed: number;
  gradingCount: number;
  handleStartManualReviewForFailed: () => void;
  lastGradingRunSummary: {
    attemptedCount: number;
    detail: string;
    extractionFailureCount: number;
    failedCount: number;
    headline: string;
    invalidResultCount: number;
    recoveryActions: string[];
    serviceFailureCount: number;
    skippedCount: number;
    successCount: number;
  } | null;
}) => {
  const studentJourney = !isLecturer ? getStudentWorkflowJourney(currentStudentSubmission?.status ?? null) : null;
  const recoverySummary = lastGradingRunSummary;
  const hasRetryableFailures = (recoverySummary?.failedCount ?? 0) > 0 || (recoverySummary?.invalidResultCount ?? 0) > 0;
  const hasManualReviewRecovery =
    (recoverySummary?.failedCount ?? 0) > 0 ||
    (recoverySummary?.invalidResultCount ?? 0) > 0 ||
    (recoverySummary?.extractionFailureCount ?? 0) > 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Workflow Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLecturer && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Action controls stay visible so reviewers can follow the real lecturer workflow. In demo mode they are read-only, and the synthetic submissions below already cover AI grading, moderation, release, and integrity-review examples.
          </div>
        )}
        {!isLecturer ? (
          <>
            <input ref={fileInputRef} type="file" accept={submissionFileAccept} className="hidden" onChange={handleStudentSubmit} />
            <div className="space-y-3">
              {studentJourney && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={currentStudentSubmission?.status === "released" ? "default" : "outline"} className="text-xs">
                      {studentJourney.badge}
                    </Badge>
                    <p className="text-sm font-medium">{studentJourney.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{studentJourney.description}</p>
                  {currentStudentSubmission?.submitted_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Latest submission: {safeFormatDate(currentStudentSubmission.submitted_at, "MMM d, yyyy 'at' HH:mm")}
                    </p>
                  )}
                  {currentStudentSubmission?.status === "released" && (
                    <Button className="mt-3" size="sm" onClick={() => openReleasedResult(currentStudentSubmission)}>
                      Open Released Result
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5">
                <div>
                  <p className="text-sm font-medium">Submit your work</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {studentSubmissionAvailability.helperText}
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    PDFs must contain selectable text. Scanned/image-only PDFs may not be readable by AI grading. If unsure, upload DOCX instead.
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !studentSubmissionAvailability.canSubmit || !currentUserId}
                  className="w-full sm:w-fit"
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploading ? `Uploading... ${uploadProgress}%` : studentSubmissionAvailability.ctaLabel}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <input
              ref={bulkInputRef}
              type="file"
              multiple
              className="hidden"
              accept={submissionFileAccept}
              onChange={handleBulkUpload}
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Button onClick={() => bulkInputRef.current?.click()} disabled={uploading} className="justify-start">
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload submissions"}
              </Button>
              <Button
                variant="outline"
                onClick={handlePlagiarismCheck}
                disabled={checkingPlagiarism || submissionsCount < 1}
                className="justify-start"
              >
                {checkingPlagiarism ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                {checkingPlagiarism ? "Checking..." : submissionsCount === 1 ? "AI content check" : "Plagiarism check"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleAIGrade}
                disabled={!selectedWorkflowState.hasRegradable || grading || selectedSize === 0}
                className="justify-start"
              >
                {grading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                {grading ? "Grading..." : `AI grade / regrade${selectedSize > 0 ? ` (${selectedSize})` : ""}`}
              </Button>
              <Button
                variant="default"
                onClick={selectedWorkflowState.hasReleaseReady ? handleReleaseGrades : handleBulkApprove}
                disabled={selectedSize === 0 || (!selectedWorkflowState.hasReleaseReady && !selectedWorkflowState.hasApprovable)}
                className="justify-start"
              >
                {selectedWorkflowState.hasReleaseReady ? <Send className="mr-2 h-4 w-4" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                {selectedWorkflowState.hasReleaseReady
                  ? `Release${selectedSize > 0 ? ` (${selectedSize})` : ""}`
                  : `Approve${selectedSize > 0 ? ` (${selectedSize})` : ""}`}
              </Button>
            </div>
            <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 p-3 text-xs text-amber-800">
              PDFs must contain selectable text. Scanned/image-only PDFs may not be readable by AI grading. If unsure, upload DOCX instead.
            </div>
            {integrityRuntimeWarning ? (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                {integrityRuntimeWarning}
              </div>
            ) : null}
            {lastGradingRunSummary ? (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{lastGradingRunSummary.headline}</p>
                <p className="mt-2 text-sm">{lastGradingRunSummary.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{lastGradingRunSummary.successCount} graded</Badge>
                  <Badge variant="outline">{lastGradingRunSummary.failedCount} failed</Badge>
                  <Badge variant="outline">{lastGradingRunSummary.skippedCount} skipped</Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {lastGradingRunSummary.recoveryActions.map((action) => (
                    <p key={action}>{action}</p>
                  ))}
                </div>
                {(hasRetryableFailures || hasManualReviewRecovery) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasRetryableFailures ? (
                      <Button size="sm" variant="outline" onClick={handleRetryFailedOnly} disabled={grading}>
                        Retry failed only
                      </Button>
                    ) : null}
                    {hasManualReviewRecovery ? (
                      <Button size="sm" variant="secondary" onClick={handleStartManualReviewForFailed} disabled={grading}>
                        Start manual review
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by student, email, or file"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="ai_grading">AI grading</SelectItem>
                  <SelectItem value="ai_graded">AI graded</SelectItem>
                  <SelectItem value="first_review">First review</SelectItem>
                  <SelectItem value="moderation_pending">Moderation pending</SelectItem>
                  <SelectItem value="moderation_in_progress">Moderation in progress</SelectItem>
                  <SelectItem value="moderated">Moderated</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="under_review">Under review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportReviewedReports}>
                Export reviewed reports
              </Button>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assignment workflow lanes</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "Intake", count: workflowLaneSummary.intakeCount, helper: "Waiting to enter grading" },
                    { label: "AI in progress", count: workflowLaneSummary.aiInProgressCount, helper: "Still processing" },
                    { label: "First review", count: workflowLaneSummary.firstReviewCount, helper: "Needs human judgement" },
                    { label: "Manual review", count: workflowLaneSummary.manualReviewCount, helper: "AI was bypassed" },
                    { label: "Moderation", count: workflowLaneSummary.moderationCount, helper: "Blocked from normal release" },
                    { label: "Release ready", count: workflowLaneSummary.releaseReadyCount, helper: "Approved and waiting" },
                    { label: "Released", count: workflowLaneSummary.releasedCount, helper: "Student-visible" },
                  ].map((lane) => (
                    <div key={lane.label} className="rounded-lg border bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">{lane.label}</p>
                      <p className="mt-1 text-lg font-semibold">{lane.count}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{lane.helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next operational move</p>
                <p className="mt-3 text-sm font-semibold">{selectedWorkflowGuidance.headline}</p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedWorkflowGuidance.detail}</p>
                <div className="mt-4 rounded-lg border bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">Assignment pressure</p>
                  <p className="mt-1 text-sm font-medium">{workflowReadiness.likelyChallenge}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{workflowReadiness.bestNextAction}</p>
                  {workflowReadiness.manualReviewCount > 0 ? (
                    <Badge variant="outline" className="mt-3">
                      {workflowReadiness.manualReviewCount} manual review
                      {workflowReadiness.manualReviewCount === 1 ? "" : "s"} open
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {(grading || selectedSize > 0) && (
              <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                {grading ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>
                      {gradingElapsed < 30
                        ? `Processing ${gradingCount} file(s)... ${gradingElapsed}s`
                        : gradingElapsed < 90
                          ? `AI is reading and grading... ${gradingElapsed}s`
                          : `Still working... ${gradingElapsed}s - large files take longer`}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      {selectedSize} submission{selectedSize === 1 ? "" : "s"} selected. Choose the next workflow action above.
                    </span>
                    <Badge variant="outline">{selectedWorkflowState.submittedCount} submitted</Badge>
                    <Badge variant="outline">{selectedWorkflowState.approvableCount} ready to approve</Badge>
                    <Badge variant="outline">{selectedWorkflowState.releaseReadyCount} ready to release</Badge>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
