import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Scale } from "lucide-react";

import { safeFormatDate } from "@/lib/date";
import {
  evaluateModerationSignals,
  formatSubmissionStatus,
  getLatestModeratorReview,
  type ModerationAction,
} from "@/lib/moderation";
import {
  canPerformModerationAction,
  getModerationDisagreementSummary,
  getModerationEscalationSummary,
  getModerationReleaseState,
  type ModerationQueueFilter,
} from "@/lib/moderationWorkflow";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);

export const ModerationQueueSection = ({
  cases,
  onSelectCase,
  onQueueFilterChange,
  onQueueSearchChange,
  onQueueSortChange,
  onClearAssignmentFocus,
  onOpenReleaseWorkflow,
  onBulkAssignModerator,
  onBulkApproveModeration,
  onBulkModeratorChange,
  onToggleSelectAllVisible,
  onToggleSelectedCase,
  queueFilter,
  queueFilterOptions,
  queueSearch,
  queueSort,
  assignmentFocusTitle,
  bulkApprovableCaseIds,
  bulkAssignableCaseIds,
  bulkModeratorId,
  lecturers,
  selectableCaseIds,
  selectedBulkApprovalSummaries,
  saving,
  selectedCaseIds,
}: {
  cases: ModerationCaseView[];
  onSelectCase: (caseId: string) => void;
  onQueueFilterChange: (filter: ModerationQueueFilter) => void;
  onQueueSearchChange: (value: string) => void;
  onQueueSortChange: (value: "priority" | "newest" | "student") => void;
  onClearAssignmentFocus: () => void;
  onOpenReleaseWorkflow: (assignmentId: string) => void;
  onBulkAssignModerator: () => void;
  onBulkApproveModeration: () => void;
  onBulkModeratorChange: (value: string) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleSelectedCase: (caseId: string, checked: boolean) => void;
  queueFilter: ModerationQueueFilter;
  queueFilterOptions: Array<{
    value: ModerationQueueFilter;
    label: string;
    count: number;
  }>;
  queueSearch: string;
  queueSort: "priority" | "newest" | "student";
  assignmentFocusTitle: string | null;
  bulkApprovableCaseIds: string[];
  bulkAssignableCaseIds: string[];
  bulkModeratorId: string;
  lecturers: Profile[];
  selectableCaseIds: string[];
  selectedBulkApprovalSummaries: Array<{
    caseId: string;
    studentLabel: string;
    assignmentTitle: string;
    disagreementLabel: string;
    baselineScore: number | null;
    moderatorScore: number | null;
    feedbackChanged: boolean;
  }>;
  saving: boolean;
  selectedCaseIds: string[];
}) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Moderation Queue</CardTitle>
      </div>
      <CardDescription>
        Moderation reuses the existing confidence, integrity, maths, and lecturer override signals. It does not auto-release final grades.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {queueFilterOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={queueFilter === option.value ? "default" : "outline"}
            data-testid={`moderation-filter-${option.value}`}
            onClick={() => onQueueFilterChange(option.value)}
          >
            {option.label} ({option.count})
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          value={queueSearch}
          onChange={(event) => onQueueSearchChange(event.target.value)}
          placeholder="Search by student, assignment, moderator, or status"
          data-testid="moderation-queue-search"
        />
        <Select value={queueSort} onValueChange={(value: "priority" | "newest" | "student") => onQueueSortChange(value)}>
          <SelectTrigger data-testid="moderation-queue-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority order</SelectItem>
            <SelectItem value="newest">Newest updated</SelectItem>
            <SelectItem value="student">Student name</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {assignmentFocusTitle && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
          <p className="text-sm text-muted-foreground">
            Focused on assignment: <span className="font-medium text-foreground">{assignmentFocusTitle}</span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClearAssignmentFocus}
            data-testid="moderation-clear-assignment-focus"
          >
            Show all assignments
          </Button>
        </div>
      )}
      {bulkAssignableCaseIds.length > 0 && (
        <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 lg:grid-cols-[auto_minmax(0,1fr)_220px_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={
                bulkAssignableCaseIds.length > 0 &&
                bulkAssignableCaseIds.every((caseId) => selectedCaseIds.includes(caseId))
              }
              onCheckedChange={(checked) => onToggleSelectAllVisible(Boolean(checked))}
              data-testid="moderation-bulk-select-all"
            />
            <p className="text-sm font-medium">
              {selectedCaseIds.filter((caseId) => selectableCaseIds.includes(caseId)).length} case(s) selected
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Assign one moderator across visible owner-managed pending or in-progress cases.
          </p>
          <select
            value={bulkModeratorId}
            onChange={(event) => onBulkModeratorChange(event.target.value)}
            data-testid="moderation-bulk-moderator-select"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="unassigned">Choose moderator</option>
            {lecturers.map((lecturer) => (
              <option key={lecturer.id} value={lecturer.id}>
                {lecturer.full_name || lecturer.email || lecturer.id}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={onBulkAssignModerator}
            disabled={saving || selectedCaseIds.filter((caseId) => bulkAssignableCaseIds.includes(caseId)).length === 0}
            data-testid="moderation-bulk-assign"
          >
            Assign selected
          </Button>
        </div>
      )}
      {bulkApprovableCaseIds.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Bulk owner approval</p>
              <p className="text-sm text-muted-foreground">
                Approve selected moderated cases only after checking the disagreement summaries below.
              </p>
            </div>
            <Button
              type="button"
              onClick={onBulkApproveModeration}
              disabled={saving || selectedBulkApprovalSummaries.length === 0}
              data-testid="moderation-bulk-approve"
            >
              Approve selected moderated cases
            </Button>
          </div>
          {selectedBulkApprovalSummaries.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {selectedBulkApprovalSummaries.map((summary) => (
                <div
                  key={summary.caseId}
                  className="rounded-lg border bg-background p-3"
                  data-testid={`moderation-bulk-approval-summary-${summary.caseId}`}
                >
                  <p className="text-sm font-medium">{summary.studentLabel}</p>
                  <p className="text-xs text-muted-foreground">{summary.assignmentTitle}</p>
                  <p className="mt-2 text-sm">{summary.disagreementLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    First marker score: {summary.baselineScore ?? "-"} | Moderator score: {summary.moderatorScore ?? "-"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Feedback change: {summary.feedbackChanged ? "Changed" : "No material change recorded"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select moderated owner-owned cases to preview the disagreement summary before bulk approval.
            </p>
          )}
        </div>
      )}
      {cases.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No moderation cases match the current search and filter.
        </p>
      ) : (
        cases.map((item) => {
          const latestModeratorReview = getLatestModeratorReview(item.reviews);
          const disagreement = getModerationDisagreementSummary({
            moderationCase: item.moderationCase,
            grade: item.grade,
            latestModeratorReview,
          });
          const escalationSummary =
            item.moderationCase.status === "escalated"
              ? getModerationEscalationSummary({
                  moderationCase: item.moderationCase,
                  disagreement,
                  latestModeratorReview,
                })
              : null;
          const moderationSignals = evaluateModerationSignals({
            grade: item.grade,
            integrityReview: item.integrityReview,
            maxScore: item.assignment?.max_score ?? 100,
          });
          const releaseState = getModerationReleaseState({
            moderationCase: item.moderationCase,
            submissionStatus: item.submission?.status ?? item.moderationCase.status,
          });

          return (
            <div
              key={item.moderationCase.id}
              data-testid={`moderation-case-${item.moderationCase.id}`}
              className="rounded-xl border p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedCaseIds.includes(item.moderationCase.id)}
                      disabled={!selectableCaseIds.includes(item.moderationCase.id)}
                      onCheckedChange={(checked) => onToggleSelectedCase(item.moderationCase.id, Boolean(checked))}
                      data-testid={`moderation-select-${item.moderationCase.id}`}
                    />
                  </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {item.submission?.student_name || item.submission?.student_email || "Student record unavailable"}
                    </p>
                    <Badge variant="outline">{formatSubmissionStatus(item.moderationCase.status)}</Badge>
                    {item.moderationCase.integrity_risk_score != null && item.moderationCase.integrity_risk_score >= 55 && (
                      <Badge variant="secondary">Integrity risk {item.moderationCase.integrity_risk_score}%</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.assignment?.title || "Assignment"} - Submitted{" "}
                    {safeFormatDate(item.submission?.submitted_at, "MMM d, yyyy HH:mm")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    First marker: {item.firstMarker?.full_name || "Unassigned"} - Moderator:{" "}
                    {item.moderator?.full_name || "Unassigned"}
                  </p>
                  {item.moderationCase.trigger_summary && (
                    <p className="text-xs text-muted-foreground">{item.moderationCase.trigger_summary}</p>
                  )}
                  {item.moderationCase.status === "moderated" && (
                    <p className="text-xs text-muted-foreground">{disagreement.label}</p>
                  )}
                  {item.moderationCase.status === "escalated" && escalationSummary && (
                    <>
                      <p className="text-xs font-medium text-amber-700">{escalationSummary.headline}</p>
                      <p className="text-xs text-muted-foreground">{escalationSummary.resolutionState}</p>
                    </>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {moderationSignals.signals.map((signal) => (
                      <Badge key={`${item.moderationCase.id}-${signal.code}`} variant="outline" className="text-xs">
                        {signal.label}
                      </Badge>
                    ))}
                    <Badge
                      variant={
                        releaseState.tone === "ready"
                          ? "default"
                          : releaseState.tone === "released"
                            ? "default"
                            : releaseState.tone === "approval"
                              ? "outline"
                              : "secondary"
                      }
                      className="text-xs"
                    >
                      {releaseState.badge}
                    </Badge>
                    {item.moderationCase.status === "moderated" && (
                      <Badge variant={disagreement.hasMaterialChange ? "secondary" : "outline"} className="text-xs">
                        {disagreement.hasMaterialChange ? "Moderator changed outcome" : "Moderator confirmed outcome"}
                      </Badge>
                    )}
                    {item.moderationCase.status === "escalated" && (
                      <Badge variant="secondary" className="text-xs">
                        Escalated dispute
                      </Badge>
                    )}
                    {!selectableCaseIds.includes(item.moderationCase.id) && (
                      <Badge variant="outline" className="text-xs">
                        Individual-only
                      </Badge>
                    )}
                    {bulkApprovableCaseIds.includes(item.moderationCase.id) && (
                      <Badge variant="outline" className="text-xs">
                        Bulk approval ready
                      </Badge>
                    )}
                  </div>
                </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-right text-xs text-muted-foreground">
                    <p>AI {item.grade?.ai_score ?? "-"}</p>
                    <p>First marker {item.moderationCase.first_marker_score ?? item.grade?.lecturer_score ?? "-"}</p>
                    <p>Moderator {latestModeratorReview?.proposed_score ?? item.moderationCase.moderator_score ?? "-"}</p>
                    <p>Agreed {item.moderationCase.final_agreed_score ?? "-"}</p>
                  </div>
                  <Button
                    data-testid={`moderation-review-open-${item.moderationCase.id}`}
                    size="sm"
                    variant="outline"
                    disabled={!item.submission}
                    onClick={() => onSelectCase(item.moderationCase.id)}
                  >
                    Review case
                  </Button>
                  {releaseState.tone === "ready" && item.assignment && (
                    <Button
                      data-testid={`moderation-open-release-${item.moderationCase.id}`}
                      size="sm"
                      onClick={() => onOpenReleaseWorkflow(item.assignment!.id)}
                    >
                      Open release workflow
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </CardContent>
  </Card>
);

export const ModerationReviewDialog = ({
  feedbackDraft,
  lecturers,
  moderatorDrafts,
  noteDraft,
  onAssignModerator,
  onClose,
  onFeedbackDraftChange,
  onModeratorDraftChange,
  onNoteDraftChange,
  onSaveAction,
  onScoreDraftChange,
  open,
  saving,
  scoreDraft,
  selectedCase,
  userId,
}: {
  feedbackDraft: string;
  lecturers: Profile[];
  moderatorDrafts: Record<string, string>;
  noteDraft: string;
  onAssignModerator: (item: ModerationCaseView) => void;
  onClose: () => void;
  onFeedbackDraftChange: (value: string) => void;
  onModeratorDraftChange: (caseId: string, value: string) => void;
  onNoteDraftChange: (value: string) => void;
  onSaveAction: (action: ModerationAction) => void;
  onScoreDraftChange: (value: string) => void;
  open: boolean;
  saving: boolean;
  scoreDraft: string;
  selectedCase: ModerationCaseView | null;
  userId?: string | null;
}) => (
  <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
    <DialogContent data-testid="moderation-review-dialog" className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Moderation Review</DialogTitle>
        <DialogDescription>
          {selectedCase?.submission?.student_name || selectedCase?.submission?.student_email || "Student record unavailable"} -{" "}
          {selectedCase?.assignment?.title || "Assignment"}
        </DialogDescription>
      </DialogHeader>

      {selectedCase && (
        <div className="space-y-5 pt-2">
          {(() => {
            const latestModeratorReview = getLatestModeratorReview(selectedCase.reviews);
            const disagreement = getModerationDisagreementSummary({
              moderationCase: selectedCase.moderationCase,
              grade: selectedCase.grade,
              latestModeratorReview,
            });
            const escalationSummary =
              selectedCase.moderationCase.status === "escalated"
                ? getModerationEscalationSummary({
                    moderationCase: selectedCase.moderationCase,
                    disagreement,
                    latestModeratorReview,
                  })
                : null;

            return (
              <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "AI score", value: selectedCase.grade?.ai_score ?? "-" },
              { label: "First marker", value: selectedCase.moderationCase.first_marker_score ?? selectedCase.grade?.lecturer_score ?? "-" },
              { label: "Moderator", value: latestModeratorReview?.proposed_score ?? selectedCase.moderationCase.moderator_score ?? "-" },
              { label: "Final agreed", value: selectedCase.moderationCase.final_agreed_score ?? "-" },
              { label: "Confidence", value: selectedCase.moderationCase.confidence_score != null ? `${Math.round(selectedCase.moderationCase.confidence_score * 100)}%` : "-" },
              { label: "Integrity risk", value: selectedCase.moderationCase.integrity_risk_score != null ? `${selectedCase.moderationCase.integrity_risk_score}%` : "-" },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {selectedCase.moderationCase.status === "moderated" && (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="font-medium">{disagreement.label}</p>
              <p className="mt-1 text-muted-foreground">
                First marker score: {disagreement.baselineScore ?? "-"} | Moderator score: {disagreement.moderatorScore ?? "-"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Feedback change: {disagreement.feedbackChanged ? "Changed" : "No material change recorded"}
              </p>
            </div>
          )}
          {selectedCase.moderationCase.status === "escalated" && escalationSummary && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
              <p className="font-medium text-amber-900">{escalationSummary.headline}</p>
              <p className="mt-1 text-amber-900/80">{escalationSummary.resolutionState}</p>
              <p className="mt-2 text-muted-foreground">
                First marker score: {disagreement.baselineScore ?? "-"} | Moderator score: {disagreement.moderatorScore ?? "-"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Feedback change: {disagreement.feedbackChanged ? "Changed" : "No material change recorded"}
              </p>
              {escalationSummary.escalationReason && (
                <p className="mt-2 text-muted-foreground">
                  Escalation reason: {escalationSummary.escalationReason}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="space-y-2">
                  <Label>Assigned moderator</Label>
                  <Select
                    value={moderatorDrafts[selectedCase.moderationCase.id] || "unassigned"}
                    onValueChange={(value) => onModeratorDraftChange(selectedCase.moderationCase.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {lecturers.map((lecturer) => (
                        <SelectItem key={lecturer.id} value={lecturer.id}>
                          {lecturer.full_name || lecturer.email || lecturer.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  data-testid={`moderation-assign-${selectedCase.moderationCase.id}`}
                  variant="outline"
                  className="w-full"
                  disabled={saving || !selectedCase.submission || selectedCase.moderationCase.lecturer_id !== userId}
                  onClick={() => onAssignModerator(selectedCase)}
                >
                  Assign Moderator
                </Button>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p>Status: {formatSubmissionStatus(selectedCase.moderationCase.status)}</p>
                  <p className="mt-1">Release state: {getModerationReleaseState({
                    moderationCase: selectedCase.moderationCase,
                    submissionStatus: selectedCase.submission?.status ?? selectedCase.moderationCase.status,
                  }).badge}</p>
                  <p className="mt-1">
                    Trigger flags: {(selectedCase.moderationCase.trigger_flags as string[]).join(", ") || "none"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  {(() => {
                    const releaseState = getModerationReleaseState({
                      moderationCase: selectedCase.moderationCase,
                      submissionStatus: selectedCase.submission?.status ?? selectedCase.moderationCase.status,
                    });

                    return (
                      <>
                        <p className="font-medium">{releaseState.badge}</p>
                        <p className="mt-1 text-muted-foreground">{releaseState.detail}</p>
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <Label>Moderation notes</Label>
                  <Textarea
                    rows={4}
                    value={noteDraft}
                    onChange={(event) => onNoteDraftChange(event.target.value)}
                    placeholder="Record the moderation rationale, comparison notes, and outcome."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Moderator score</Label>
                    <Input
                      type="number"
                      value={scoreDraft}
                      onChange={(event) => onScoreDraftChange(event.target.value)}
                      placeholder={`Out of ${selectedCase.assignment?.max_score ?? 100}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Final agreed feedback</Label>
                    <Textarea
                      rows={3}
                      value={feedbackDraft}
                      onChange={(event) => onFeedbackDraftChange(event.target.value)}
                      placeholder="Feedback text to keep with the final agreed mark."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="moderation-action-agree"
                    variant="outline"
                    disabled={
                      saving ||
                      !selectedCase.submission ||
                      !canPerformModerationAction({
                        action: "agree",
                        moderationCase: selectedCase.moderationCase,
                        userId,
                      })
                    }
                    onClick={() => onSaveAction("agree")}
                  >
                    Agree
                  </Button>
                  <Button
                    data-testid="moderation-action-adjust"
                    variant="outline"
                    disabled={
                      saving ||
                      !selectedCase.submission ||
                      !canPerformModerationAction({
                        action: "adjust",
                        moderationCase: selectedCase.moderationCase,
                        userId,
                      })
                    }
                    onClick={() => onSaveAction("adjust")}
                  >
                    Adjust
                  </Button>
                  <Button
                    data-testid="moderation-action-return"
                    variant="outline"
                    disabled={
                      saving ||
                      !selectedCase.submission ||
                      !canPerformModerationAction({
                        action: "return",
                        moderationCase: selectedCase.moderationCase,
                        userId,
                      })
                    }
                    onClick={() => onSaveAction("return")}
                  >
                    Return
                  </Button>
                  <Button
                    data-testid="moderation-action-escalate"
                    variant="outline"
                    disabled={
                      saving ||
                      !selectedCase.submission ||
                      !canPerformModerationAction({
                        action: "escalate",
                        moderationCase: selectedCase.moderationCase,
                        userId,
                      })
                    }
                    onClick={() => onSaveAction("escalate")}
                  >
                    Escalate
                  </Button>
                  <Button
                    data-testid="moderation-action-approve"
                    disabled={
                      saving ||
                      !selectedCase.submission ||
                      !canPerformModerationAction({
                        action: "approve",
                        moderationCase: selectedCase.moderationCase,
                        userId,
                      })
                    }
                    onClick={() => onSaveAction("approve")}
                  >
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Moderation History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCase.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>
                ) : (
                  selectedCase.reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{actionLabel(review.action as ModerationAction)}</Badge>
                        <Badge variant="secondary">{formatSubmissionStatus(review.reviewer_role)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {safeFormatDate(review.created_at, "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{review.notes || "No note recorded."}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audit History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedCase.auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit entries recorded yet.</p>
                ) : (
                  selectedCase.auditLog.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{formatSubmissionStatus(entry.event_type)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {safeFormatDate(entry.created_at, "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      {entry.reason && <p className="mt-2 text-sm">{entry.reason}</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
              </>
            );
          })()}
        </div>
      )}
    </DialogContent>
  </Dialog>
);
