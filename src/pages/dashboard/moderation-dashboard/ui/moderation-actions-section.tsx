import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatSubmissionStatus } from "@/lib/moderation";
import { canPerformModerationAction, getModerationNextStep, getModerationReleaseState, type ModerationCaseView, type SubmissionRow } from "@/lib/moderationWorkflow";
import type { ModerationProfile } from "../types";

const coerceSubmissionStatus = (value: string): SubmissionRow["status"] => value as SubmissionRow["status"];

type ModerationActionsSectionProps = {
  feedbackDraft: string;
  lecturers: ModerationProfile[];
  moderatorDrafts: Record<string, string>;
  noteDraft: string;
  onAssignModerator: (item: ModerationCaseView) => void;
  onFeedbackDraftChange: (value: string) => void;
  onModeratorDraftChange: (caseId: string, value: string) => void;
  onNoteDraftChange: (value: string) => void;
  onSaveAction: (action: "agree" | "adjust" | "return" | "escalate" | "approve") => void;
  onScoreDraftChange: (value: string) => void;
  saving: boolean;
  scoreDraft: string;
  selectedCase: ModerationCaseView;
  userId?: string | null;
};

export const ModerationActionsSection = ({
  feedbackDraft,
  lecturers,
  moderatorDrafts,
  noteDraft,
  onAssignModerator,
  onFeedbackDraftChange,
  onModeratorDraftChange,
  onNoteDraftChange,
  onSaveAction,
  onScoreDraftChange,
  saving,
  scoreDraft,
  selectedCase,
  userId,
}: ModerationActionsSectionProps) => {
  const nextStep = getModerationNextStep({
    item: selectedCase,
    userId,
  });
  const releaseState = getModerationReleaseState({
    moderationCase: selectedCase.moderationCase,
    submissionStatus: selectedCase.submission?.status ?? coerceSubmissionStatus(selectedCase.moderationCase.status),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>Assigned moderator</Label>
            <Select value={moderatorDrafts[selectedCase.moderationCase.id] || "unassigned"} onValueChange={(value) => onModeratorDraftChange(selectedCase.moderationCase.id, value)}>
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
            <p className="mt-1">Release state: {releaseState.badge}</p>
            <p className="mt-1">Trigger flags: {(selectedCase.moderationCase.trigger_flags as string[]).join(", ") || "none"}</p>
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
            <p className="font-medium">{releaseState.badge}</p>
            <p className="mt-1 text-muted-foreground">{releaseState.detail}</p>
          </div>
          <div className="space-y-2">
            <Label>Moderation notes</Label>
            <Textarea rows={4} value={noteDraft} onChange={(event) => onNoteDraftChange(event.target.value)} placeholder="Record the moderation rationale, comparison notes, and outcome." />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Moderator score</Label>
              <Input type="number" value={scoreDraft} onChange={(event) => onScoreDraftChange(event.target.value)} placeholder={`Out of ${selectedCase.assignment?.max_score ?? 100}`} />
            </div>
            <div className="space-y-2">
              <Label>Final agreed feedback</Label>
              <Textarea rows={3} value={feedbackDraft} onChange={(event) => onFeedbackDraftChange(event.target.value)} placeholder="Feedback text to keep with the final agreed mark." />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="moderation-action-agree"
              variant="outline"
              disabled={saving || !selectedCase.submission || !canPerformModerationAction({ action: "agree", moderationCase: selectedCase.moderationCase, userId })}
              onClick={() => onSaveAction("agree")}
            >
              Agree
            </Button>
            <Button
              data-testid="moderation-action-adjust"
              variant="outline"
              disabled={saving || !selectedCase.submission || !canPerformModerationAction({ action: "adjust", moderationCase: selectedCase.moderationCase, userId })}
              onClick={() => onSaveAction("adjust")}
            >
              Adjust
            </Button>
            <Button
              data-testid="moderation-action-return"
              variant="outline"
              disabled={saving || !selectedCase.submission || !canPerformModerationAction({ action: "return", moderationCase: selectedCase.moderationCase, userId })}
              onClick={() => onSaveAction("return")}
            >
              Return
            </Button>
            <Button
              data-testid="moderation-action-escalate"
              variant="outline"
              disabled={saving || !selectedCase.submission || !canPerformModerationAction({ action: "escalate", moderationCase: selectedCase.moderationCase, userId })}
              onClick={() => onSaveAction("escalate")}
            >
              Escalate
            </Button>
            <Button
              data-testid="moderation-action-approve"
              disabled={saving || !selectedCase.submission || !canPerformModerationAction({ action: "approve", moderationCase: selectedCase.moderationCase, userId })}
              onClick={() => onSaveAction("approve")}
            >
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
