import type { ChangeEvent, RefObject } from "react";
import {
  Brain,
  CheckCheck,
  Clock,
  Edit,
  FileText,
  Loader2,
  Search,
  Send,
  Shield,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  getSelectedWorkflowActionState,
  getSubmissionDisplayState,
} from "@/lib/assessmentWorkflow";
import { safeFormatDate } from "@/lib/date";
import { getStudentSubmissionAvailability } from "@/lib/assignmentVisibility";
import { log } from "@/lib/logger";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailBreakdown,
  AssignmentDetailSubmission,
  Grade,
  ModerationCase,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";

type WorkflowActionState = ReturnType<typeof getSelectedWorkflowActionState>;
type StudentSubmissionAvailability = ReturnType<typeof getStudentSubmissionAvailability>;

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
    icon: Brain,
    tone: "border-primary/20 text-primary",
  },
  ai_graded: {
    label: "AI Graded",
    variant: "secondary",
    icon: Brain,
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

export const WorkflowActionsSection = ({
  isDemo,
  isLecturer,
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
  submissionsCount,
  handleAIGrade,
  selectedWorkflowState,
  grading,
  selectedSize,
  handleReleaseGrades,
  handleBulkApprove,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  exportReviewedReports,
  gradingElapsed,
  gradingCount,
}: {
  isDemo: boolean;
  isLecturer: boolean;
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
  submissionsCount: number;
  handleAIGrade: () => void;
  selectedWorkflowState: WorkflowActionState;
  grading: boolean;
  selectedSize: number;
  handleReleaseGrades: () => void;
  handleBulkApprove: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: "all" | SubmissionStatus;
  setStatusFilter: (value: "all" | SubmissionStatus) => void;
  exportReviewedReports: () => void;
  gradingElapsed: number;
  gradingCount: number;
}) => (
  <Card className="shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Workflow Actions</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {isDemo && isLecturer && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          Action controls stay visible so reviewers can follow the real lecturer workflow. In demo mode they are read-only, and the synthetic submissions below already cover AI grading, moderation, release, and integrity-review examples.
        </div>
      )}
      {!isLecturer ? (
        <>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleStudentSubmit} />
          <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5">
            <div>
              <p className="text-sm font-medium">Submit your work</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {studentSubmissionAvailability.helperText}
              </p>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isDemo || uploading || !studentSubmissionAvailability.canSubmit || !currentUserId}
              className="w-full sm:w-fit"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? `Uploading... ${uploadProgress}%` : studentSubmissionAvailability.ctaLabel}
            </Button>
          </div>
        </>
      ) : (
        <>
          <input
            ref={bulkInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.zip,.py,.java,.cpp,.c,.js,.ts,.html,.css"
            onChange={handleBulkUpload}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Button onClick={() => bulkInputRef.current?.click()} disabled={isDemo || uploading} className="justify-start">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload submissions"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePlagiarismCheck}
              disabled={isDemo || checkingPlagiarism || submissionsCount < 1}
              className="justify-start"
            >
              {checkingPlagiarism ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              {checkingPlagiarism ? "Checking..." : submissionsCount === 1 ? "AI content check" : "Plagiarism check"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleAIGrade}
              disabled={isDemo || !selectedWorkflowState.hasRegradable || grading || selectedSize === 0}
              className="justify-start"
            >
              {grading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              {grading ? "Grading..." : `AI grade / regrade${selectedSize > 0 ? ` (${selectedSize})` : ""}`}
            </Button>
            <Button
              variant="default"
              onClick={selectedWorkflowState.hasReleaseReady ? handleReleaseGrades : handleBulkApprove}
              disabled={
                isDemo ||
                selectedSize === 0 ||
                (!selectedWorkflowState.hasReleaseReady && !selectedWorkflowState.hasApprovable)
              }
              className="justify-start"
            >
              {selectedWorkflowState.hasReleaseReady ? <Send className="mr-2 h-4 w-4" /> : <CheckCheck className="mr-2 h-4 w-4" />}
              {selectedWorkflowState.hasReleaseReady
                ? `Release${selectedSize > 0 ? ` (${selectedSize})` : ""}`
                : `Approve${selectedSize > 0 ? ` (${selectedSize})` : ""}`}
            </Button>
          </div>

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
  approveSubmission,
  loadSubmissions,
  queueFeedbackSummary,
  queueGradeReleaseNotification,
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
  approveSubmission: (submission: AssignmentDetailSubmission) => Promise<boolean>;
  loadSubmissions: () => Promise<void>;
  queueFeedbackSummary: (submission: AssignmentDetailSubmission) => Promise<void>;
  queueGradeReleaseNotification: (submission: AssignmentDetailSubmission) => Promise<void>;
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
            </div>

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
                      await supabase
                        .from("submissions")
                        .update({ status: "released" as const })
                        .eq("id", submission.id);
                      await queueGradeReleaseNotification(submission);
                      toast.success("Grade released to student");
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
  openSubmissionFile,
  openModeration,
  openReview,
  approveSubmission,
  loadSubmissions,
  queueFeedbackSummary,
  queueGradeReleaseNotification,
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
  openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
  openModeration: () => void;
  openReview: (submission: AssignmentDetailSubmission) => void;
  approveSubmission: (submission: AssignmentDetailSubmission) => Promise<boolean>;
  loadSubmissions: () => Promise<void>;
  queueFeedbackSummary: (submission: AssignmentDetailSubmission) => Promise<void>;
  queueGradeReleaseNotification: (submission: AssignmentDetailSubmission) => Promise<void>;
}) => (
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
              moderationCase={moderationCases[submission.id]}
              isLecturer={isLecturer}
              isDemo={isDemo}
              isSelected={selected.has(submission.id)}
              toggleSelect={toggleSelect}
              openSubmissionFile={openSubmissionFile}
              openModeration={openModeration}
              openReview={openReview}
              approveSubmission={approveSubmission}
              loadSubmissions={loadSubmissions}
              queueFeedbackSummary={queueFeedbackSummary}
              queueGradeReleaseNotification={queueGradeReleaseNotification}
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
