import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormatDate } from "@/lib/date";
import { getIntegrityReviewSummary } from "@/lib/integrityReviews";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";
import { useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows/useSubmissionFileActions";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";

const formatJsonLabel = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Unavailable";

const toAssignmentDetailSubmission = (submission: NonNullable<ModerationCaseView["submission"]>): AssignmentDetailSubmission => ({
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

const asEvidenceList = (value: unknown) => (Array.isArray(value) ? value : []);

type ModerationEvidenceSectionProps = {
  selectedCase: ModerationCaseView;
};

export const ModerationEvidenceSection = ({ selectedCase }: ModerationEvidenceSectionProps) => {
  const { openSubmissionFile } = useSubmissionFileActions();
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Submission Evidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="font-medium">Submission file</p>
            <p className="mt-1 text-muted-foreground">{selectedCase.submission?.file_name || "No file recorded"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedCase.submission?.file_type || "Unknown type"}</p>
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
            <p className="mt-1 text-muted-foreground">{selectedCase.assignment?.module_code || "Module code unavailable"}</p>
            <p className="mt-1 text-muted-foreground">Max score: {selectedCase.assignment?.max_score ?? 100}</p>
            <p className="mt-1 text-muted-foreground">Due: {safeFormatDate(selectedCase.assignment?.due_date, "MMM d, yyyy HH:mm")}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Rubric</p>
          {rubricItems.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">No rubric criteria were attached to this assignment.</div>
          ) : (
            <div className="space-y-2">
              {rubricItems.map((item, index) => {
                const criterion = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
                const title = String(criterion.name ?? criterion.criterion ?? criterion.title ?? `Criterion ${index + 1}`);
                const description = criterion.description ? String(criterion.description) : null;
                const maxScore = criterion.max_score ?? criterion.maxScore ?? criterion.points;

                return (
                  <div key={`${title}-${index}`} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{title}</p>
                      {maxScore != null && <Badge variant="outline">{String(maxScore)} pts</Badge>}
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
                  <p className="whitespace-pre-wrap">{selectedCase.grade?.ai_feedback || "No AI feedback was recorded for this submission."}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">First marker rationale</p>
                <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-muted-foreground">
                  <p className="whitespace-pre-wrap">{selectedCase.grade?.lecturer_feedback || "No lecturer feedback was recorded before moderation."}</p>
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
                    <Badge variant="outline">{formatJsonLabel(selectedCase.integrityReview.review_type)}</Badge>
                    <Badge variant="secondary">{formatJsonLabel(selectedCase.integrityReview.decision)}</Badge>
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
                <div className="rounded-lg border bg-muted/20 p-3 text-muted-foreground">No integrity review is attached to this moderation case.</div>
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
                      <p className="font-medium">{String(breakdown.criterion ?? `Criterion ${index + 1}`)}</p>
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
                      <p className="mt-2 text-muted-foreground">{breakdown.evidence_snippet}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
