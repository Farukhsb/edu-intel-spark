import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CriterionBars } from "@/components/dashboard/CriterionBars";
import { useAuth } from "@/contexts/AuthContext";
import { logAcademicAccessEvent } from "@/lib/audit/academicAccessEvents";

import type { AssignmentDetailSubmission, Grade } from "@/pages/dashboard/assignment-detail/types";

export interface SubmissionReviewDialogProps {
  assignmentMaxScore: number;
  editFeedback: string;
  editScore: string;
  grade: Grade | null;
  isDemo: boolean;
  onEditFeedbackChange: Dispatch<SetStateAction<string>>;
  onEditScoreChange: Dispatch<SetStateAction<string>>;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  reviewSubmission: AssignmentDetailSubmission | null;
}

export const SubmissionReviewDialog = ({
  assignmentMaxScore,
  editFeedback,
  editScore,
  grade,
  isDemo,
  onEditFeedbackChange,
  onEditScoreChange,
  onOpenChange,
  onSave,
  open,
  reviewSubmission,
}: SubmissionReviewDialogProps) => {
  const { user, profile, isDemo: sessionIsDemo } = useAuth();
  const lastLoggedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !reviewSubmission || sessionIsDemo) {
      return;
    }

    const logKey = `${reviewSubmission.id}:${grade?.id ?? "no-grade"}`;
    if (lastLoggedKeyRef.current === logKey) {
      return;
    }
    lastLoggedKeyRef.current = logKey;

    void logAcademicAccessEvent({
      actorId: user?.id,
      actorRole: profile?.role ?? null,
      eventType: "submission_viewed",
      resourceType: "submission",
      resourceId: reviewSubmission.id,
      assignmentId: reviewSubmission.assignment_id,
      submissionId: reviewSubmission.id,
      metadata: {
        source: "assignment_review_dialog",
        status: reviewSubmission.status,
      },
    });

    void logAcademicAccessEvent({
      actorId: user?.id,
      actorRole: profile?.role ?? null,
      eventType: "grade_details_viewed",
      resourceType: "grade",
      resourceId: grade?.id ?? reviewSubmission.id,
      assignmentId: reviewSubmission.assignment_id,
      submissionId: reviewSubmission.id,
      metadata: {
        source: "assignment_review_dialog",
        hasAiDraft: Boolean(grade?.ai_score != null),
      },
    });
  }, [grade?.ai_score, grade?.id, open, profile?.role, reviewSubmission, sessionIsDemo, user?.id]);

  return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-testid="submission-review-dialog" className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Review Submission</DialogTitle>
        <DialogDescription>
          {reviewSubmission?.student_name || "Student"} - {reviewSubmission?.file_name}
        </DialogDescription>
      </DialogHeader>
      {reviewSubmission && grade && (
        <div className="space-y-4 pt-2">
          <Card className="bg-muted/40">
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {grade.ai_score != null ? "AI Score" : "Manual review mode"}
              </p>
              <p className="text-lg font-bold font-display">
                {grade.ai_score != null ? `${grade.ai_score}/${assignmentMaxScore}` : "No AI draft score"}
              </p>
              <div className="flex flex-wrap gap-2">
                {grade.assignment_type && <Badge variant="outline">{grade.assignment_type}</Badge>}
                {typeof grade.grading_confidence === "number" && (
                  <Badge variant={grade.grading_confidence < 0.7 ? "secondary" : "outline"}>
                    Confidence {Math.round(grade.grading_confidence * 100)}%
                  </Badge>
                )}
                {Boolean(grade.grading_metadata?.math_analysis?.solver_signals?.length) && (
                  <Badge variant="secondary">Solver review flagged</Badge>
                )}
                {Boolean(grade.grading_metadata?.fairness_notes?.length) && (
                  <Badge variant="secondary">Fairness adjustment noted</Badge>
                )}
              </div>
              {Boolean(grade.grading_metadata?.fairness_notes?.length) && (
                <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                  {(grade.grading_metadata?.fairness_notes ?? []).map((note, index) => (
                    <p key={index} className={index > 0 ? "mt-1" : ""}>
                      {note}
                    </p>
                  ))}
                </div>
              )}
              <p className="pt-1 text-xs font-medium text-muted-foreground">
                {grade.ai_feedback ? "AI Feedback" : "Lecturer starting point"}
              </p>
              <div className="max-h-56 overflow-y-auto rounded-md bg-background/80 p-3">
                <p className="whitespace-pre-wrap text-sm">
                  {grade.ai_feedback || "No AI feedback is available for this submission. Enter your own score and feedback below to continue with manual review."}
                </p>
              </div>
              {(grade.ai_breakdown?.length ?? 0) > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
                  <CriterionBars
                    compact
                    items={(grade.ai_breakdown ?? []).map((breakdownItem) => ({
                      criterion: breakdownItem.criterion,
                      score: breakdownItem.score,
                      maxScore: breakdownItem.max_score,
                      confidenceScore: breakdownItem.confidence_score ?? null,
                      reviewRequired: breakdownItem.review_required ?? null,
                      evidenceSnippet: breakdownItem.evidence_snippet ?? null,
                      errorType: breakdownItem.error_type ?? null,
                    }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Score (optional override)</label>
            <Input
              type="number"
              value={editScore}
              onChange={(event) => onEditScoreChange(event.target.value)}
              placeholder={`Out of ${assignmentMaxScore}`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Feedback (optional)</label>
            <Textarea
              value={editFeedback}
              onChange={(event) => onEditFeedbackChange(event.target.value)}
              rows={4}
              placeholder="Add or edit feedback..."
            />
          </div>
          <div className="flex gap-2">
            <Button data-testid="submission-review-save" onClick={onSave} disabled={isDemo} className="flex-1">
              Save Review
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
  );
};
