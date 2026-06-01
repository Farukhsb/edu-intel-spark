import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { safeFormatDate } from "@/lib/date";
import { getIntegrityReviewSummary } from "@/lib/integrityReviews";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";
import { useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows/useSubmissionFileActions";
import {
  formatSubmissionStatus,
  getLatestModeratorReview,
  type ModerationAction,
} from "@/lib/moderation";
import {
  canPerformModerationAction,
  getModerationDisagreementSummary,
  getModerationEscalationSummary,
  getModerationNextStep,
  getModerationReleaseState,
  type ModerationCaseView,
  type SubmissionRow,
} from "@/lib/moderationWorkflow";

import type { ModerationProfile } from "../types";
import type { ModerationReviewDialogProps } from "./review-dialog";

const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);
const coerceSubmissionStatus = (value: string): SubmissionRow["status"] =>
  value as SubmissionRow["status"];

const asEvidenceList = (value: unknown) => (Array.isArray(value) ? value : []);
const formatJsonLabel = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Unavailable";
const toAssignmentDetailSubmission = (submission: SubmissionRow): AssignmentDetailSubmission => ({
  assignment_id: submission.assignment_id,
  file_name: submission.file_name,
  file_type: submission.file_type,
  file_url: submission.file_url,
  id: submission.id,
  status: submission.status,
  student_email: submission.student_email,
  student_id: submission.student_id,
  student_name: submission.student_name,
  submitted_at: submission.submitted_at,
});

export const DemoModerationReviewDialog = ({
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
}: ModerationReviewDialogProps) => {
  const { openSubmissionFile } = useSubmissionFileActions();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent data-testid="moderation-review-dialog" className="max-h-[88vh] overflow-y-auto sm:max-w-6xl">
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
              const nextStep = getModerationNextStep({
                item: selectedCase,
                userId,
              });
              const integrityPayload = selectedCase.integrityReview
                ? getIntegrityReviewSummary({
                    lecturer_note: selectedCase.integrityReview.lecturer_note,
                    updated_at: selectedCase.integrityReview.updated_at,
                    decision: selectedCase.integrityReview.decision,
                  }).payload
                : null;
              const rubricItems = asEvidenceList(selectedCase.assignment?.rubric);
              const aiBreakdown = asEvidenceList(selectedCase.grade?.ai_breakdown);
              const hasSubmissionFile = Boolean(selectedCase.submission?.file_url?.trim());

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

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Submission Evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                              <p className="font-medium">Submission file</p>
                              <p className="mt-1 text-muted-foreground">
                                {selectedCase.submission?.file_name || "No file recorded"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {selectedCase.submission?.file_type || "Unknown type"}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-3"
                                disabled={!selectedCase.submission || !hasSubmissionFile}
                                onClick={() =>
                                  selectedCase.submission &&
                                  openSubmissionFile(toAssignmentDetailSubmission(selectedCase.submission), {
                                    source: "moderation_review_dialog",
                                    resourceType: "submission_file",
                                    moderationCaseId: selectedCase.moderationCase.id,
                                  })
                                }
                              >
                                Open submission file
                              </Button>
                              {!hasSubmissionFile && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  The original file is not attached to this case. Use the recorded grading evidence below or escalate if the artifact is required.
                                </p>
                              )}
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                              <p className="font-medium">Assignment context</p>
                              <p className="mt-1 text-muted-foreground">
                                {selectedCase.assignment?.module_code || "Module code unavailable"}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                Max score: {selectedCase.assignment?.max_score ?? 100}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                Due: {safeFormatDate(selectedCase.assignment?.due_date, "MMM d, yyyy HH:mm")}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium">Rubric</p>
                            {rubricItems.length === 0 ? (
                              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                                No rubric criteria were attached to this assignment.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {rubricItems.map((item, index) => {
                                  const criterion = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
                                  const title =
                                    String(
                                      criterion.name ??
                                        criterion.criterion ??
                                        criterion.title ??
                                        `Criterion ${index + 1}`,
                                    );
                                  const description = criterion.description ? String(criterion.description) : null;
                                  const maxScore = criterion.max_score ?? criterion.maxScore ?? criterion.points;

                                  return (
                                    <div key={`${title}-${index}`} className="rounded-lg border p-3 text-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-medium">{title}</p>
                                        {maxScore != null && (
                                          <Badge variant="outline">
                                            {String(maxScore)} pts
                                          </Badge>
                                        )}
                                      </div>
                                      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Marking Evidence</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div>
                                  <p className="font-medium">AI rationale</p>
                                  <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-muted-foreground">
                                    <p className="whitespace-pre-wrap">
                                      {selectedCase.grade?.ai_feedback || "No AI feedback was recorded for this submission."}
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  <p className="font-medium">First marker rationale</p>
                                  <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-muted-foreground">
                                    <p className="whitespace-pre-wrap">
                                      {selectedCase.grade?.lecturer_feedback || "No lecturer feedback was recorded before moderation."}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Integrity Context</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                {selectedCase.integrityReview ? (
                                  <>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="outline">
                                        {formatJsonLabel(selectedCase.integrityReview.review_type)}
                                      </Badge>
                                      <Badge variant="secondary">
                                        {formatJsonLabel(selectedCase.integrityReview.decision)}
                                      </Badge>
                                    </div>
                                    {selectedCase.integrityReview.evidence_summary && (
                                      <div className="rounded-lg border bg-muted/20 p-3 text-muted-foreground">
                                        <p className="whitespace-pre-wrap">{selectedCase.integrityReview.evidence_summary}</p>
                                      </div>
                                    )}
                                    {integrityPayload?.latestNote && (
                                      <div className="rounded-lg border bg-muted/20 p-3 text-muted-foreground">
                                        <p className="whitespace-pre-wrap">{integrityPayload.latestNote}</p>
                                      </div>
                                    )}
                                    {integrityPayload && integrityPayload.history.length > 0 && (
                                      <div className="space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">Integrity review history</p>
                                        <div className="space-y-2">
                                          {integrityPayload.history.slice(0, 3).map((entry) => (
                                            <div key={entry.id} className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{formatJsonLabel(entry.decision)}</Badge>
                                                <span>{safeFormatDate(entry.createdAt, "MMM d, yyyy HH:mm")}</span>
                                              </div>
                                              <p className="mt-2 whitespace-pre-wrap">{entry.note}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="rounded-lg border bg-muted/20 p-3 text-muted-foreground">
                                    No integrity review is attached to this moderation case.
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          {aiBreakdown.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">AI breakdown</p>
                              <div className="space-y-2">
                                {aiBreakdown.map((item, index) => {
                                  const breakdown = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
                                  return (
                                    <div key={index} className="rounded-lg border p-3 text-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-medium">
                                          {String(breakdown.criterion ?? `Criterion ${index + 1}`)}
                                        </p>
                                        <p className="text-muted-foreground">
                                          {String(breakdown.score ?? "-")}/{String(breakdown.max_score ?? "-")}
                                        </p>
                                      </div>
                                      {typeof breakdown.confidence_score === "number" && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          Confidence {Math.round(breakdown.confidence_score * 100)}%
                                          {breakdown.review_required ? " - lecturer review required" : ""}
                                        </p>
                                      )}
                                      {typeof breakdown.evidence_snippet === "string" && breakdown.evidence_snippet.length > 0 && (
                                        <p className="mt-2 text-muted-foreground">
                                          {breakdown.evidence_snippet}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
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
                              submissionStatus: selectedCase.submission?.status ?? coerceSubmissionStatus(selectedCase.moderationCase.status),
                            }).badge}</p>
                            <p className="mt-1">
                              Trigger flags: {(selectedCase.moderationCase.trigger_flags as string[]).join(", ") || "none"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="space-y-4 p-4">
                          <div className="rounded-lg border bg-muted/20 p-3 text-sm" data-testid="moderation-dialog-next-step">
                            <p className="font-medium">{nextStep.headline}</p>
                            <p className="mt-1 text-muted-foreground">{nextStep.detail}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                            {(() => {
                              const releaseState = getModerationReleaseState({
                                moderationCase: selectedCase.moderationCase,
                                submissionStatus: selectedCase.submission?.status ?? coerceSubmissionStatus(selectedCase.moderationCase.status),
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
                              {entry.reason && (
                                <p className="mt-2 text-sm">
                                  {typeof entry.reason === "string" ? entry.reason : String(entry.reason)}
                                </p>
                              )}
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
};
