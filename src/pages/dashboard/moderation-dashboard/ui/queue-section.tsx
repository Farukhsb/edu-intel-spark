import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { safeFormatDate } from "@/lib/date";
import {
  evaluateModerationSignals,
  formatSubmissionStatus,
  getLatestModeratorReview,
} from "@/lib/moderation";
import {
  getModerationDisagreementSummary,
  getModerationEscalationSummary,
  getModerationNextStep,
  getModerationReleaseState,
  type ModerationCaseView,
  type ModerationQueueFilter,
  type SubmissionRow,
} from "@/lib/moderationWorkflow";
import { Scale } from "lucide-react";

import type {
  ModerationBulkApprovalSummary,
  ModerationProfile,
} from "../types";

const coerceSubmissionStatus = (value: string): SubmissionRow["status"] =>
  value as SubmissionRow["status"];

type ModerationQueueSectionProps = {
  assignmentFocusTitle: string | null;
  bulkApprovableCaseIds: string[];
  bulkAssignableCaseIds: string[];
  bulkModeratorId: string;
  cases: ModerationCaseView[];
  lecturers: ModerationProfile[];
  onBulkApproveModeration: () => void;
  onBulkAssignModerator: () => void;
  onBulkModeratorChange: (value: string) => void;
  onClearAssignmentFocus: () => void;
  onOpenReleaseWorkflow: (assignmentId: string) => void;
  onQueueFilterChange: (filter: ModerationQueueFilter) => void;
  onQueueSearchChange: (value: string) => void;
  onQueueSortChange: (value: "priority" | "newest" | "student") => void;
  onSelectCase: (caseId: string) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToggleSelectedCase: (caseId: string, checked: boolean) => void;
  queueFilter: ModerationQueueFilter;
  queueFilterOptions: Array<{
    count: number;
    label: string;
    value: ModerationQueueFilter;
  }>;
  queueSearch: string;
  queueSort: "priority" | "newest" | "student";
  saving: boolean;
  selectableCaseIds: string[];
  selectedBulkApprovalSummaries: ModerationBulkApprovalSummary[];
  selectedCaseIds: string[];
  userId?: string | null;
};

export const ModerationQueueSection = ({
  assignmentFocusTitle,
  bulkApprovableCaseIds,
  bulkAssignableCaseIds,
  bulkModeratorId,
  cases,
  lecturers,
  onBulkApproveModeration,
  onBulkAssignModerator,
  onBulkModeratorChange,
  onClearAssignmentFocus,
  onOpenReleaseWorkflow,
  onQueueFilterChange,
  onQueueSearchChange,
  onQueueSortChange,
  onSelectCase,
  onToggleSelectAllVisible,
  onToggleSelectedCase,
  queueFilter,
  queueFilterOptions,
  queueSearch,
  queueSort,
  saving,
  selectableCaseIds,
  selectedBulkApprovalSummaries,
  selectedCaseIds,
  userId,
}: ModerationQueueSectionProps) => (
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
          const assignmentId = item.assignment?.id ?? null;
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
          const nextStep = getModerationNextStep({
            item,
            userId,
          });
          const releaseState = getModerationReleaseState({
            moderationCase: item.moderationCase,
            submissionStatus: item.submission?.status ?? coerceSubmissionStatus(item.moderationCase.status),
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
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs" data-testid={`moderation-next-step-${item.moderationCase.id}`}>
                      <p className="font-medium">{nextStep.headline}</p>
                      <p className="mt-1 text-muted-foreground">{nextStep.detail}</p>
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
                  {releaseState.tone === "ready" && assignmentId && (
                    <Button
                      data-testid={`moderation-open-release-${item.moderationCase.id}`}
                      size="sm"
                      onClick={() => onOpenReleaseWorkflow(assignmentId)}
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
