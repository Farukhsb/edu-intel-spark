import type { Dispatch, SetStateAction } from "react";

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

import type { AssignmentDetailSubmission, Grade } from "@/pages/dashboard/assignment-detail/types";

interface SubmissionReviewDialogProps {
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
}: SubmissionReviewDialogProps) => (
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
              <p className="text-xs font-medium text-muted-foreground">AI Score</p>
              <p className="text-lg font-bold font-display">
                {grade.ai_score}/{assignmentMaxScore}
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
              <p className="pt-1 text-xs font-medium text-muted-foreground">AI Feedback</p>
              <div className="max-h-56 overflow-y-auto rounded-md bg-background/80 p-3">
                <p className="whitespace-pre-wrap text-sm">{grade.ai_feedback || "N/A"}</p>
              </div>
              {(grade.ai_breakdown?.length ?? 0) > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-background/80 p-3">
                    {(grade.ai_breakdown ?? []).map((breakdownItem, index) => (
                      <div key={index} className="space-y-1 rounded-md border bg-background p-2 text-xs">
                        <div className="flex justify-between gap-3">
                          <span>{breakdownItem.criterion}</span>
                          <span className="font-medium">
                            {breakdownItem.score}/{breakdownItem.max_score}
                          </span>
                        </div>
                        {typeof breakdownItem.confidence_score === "number" && (
                          <p className="text-muted-foreground">
                            Confidence {Math.round(breakdownItem.confidence_score * 100)}%
                            {breakdownItem.review_required ? " - lecturer review" : ""}
                          </p>
                        )}
                        {breakdownItem.evidence_snippet && (
                          <p className="text-muted-foreground">Evidence: {breakdownItem.evidence_snippet}</p>
                        )}
                        {breakdownItem.error_type && breakdownItem.error_type !== "none" && (
                          <p className="text-muted-foreground">
                            Error type: {String(breakdownItem.error_type).replace("_", " ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
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
