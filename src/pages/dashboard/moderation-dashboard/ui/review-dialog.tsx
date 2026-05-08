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
import {
  formatSubmissionStatus,
  getLatestModeratorReview,
  type ModerationAction,
} from "@/lib/moderation";
import {
  canPerformModerationAction,
  getModerationDisagreementSummary,
  getModerationEscalationSummary,
  getModerationReleaseState,
  type ModerationCaseView,
  type SubmissionRow,
} from "@/lib/moderationWorkflow";

import type { ModerationProfile } from "../types";

const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);
const coerceSubmissionStatus = (value: string): SubmissionRow["status"] =>
  value as SubmissionRow["status"];

type ModerationReviewDialogProps = {
  feedbackDraft: string;
  lecturers: ModerationProfile[];
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
};

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
}: ModerationReviewDialogProps) => (
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
