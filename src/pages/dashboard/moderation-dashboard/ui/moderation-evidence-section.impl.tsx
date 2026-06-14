import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIntegrityReviewSummary } from "@/lib/integrityReviews";

import type { ModerationCaseView } from "@/lib/moderationWorkflow";
import { useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows/useSubmissionFileActions";

import {
  AIBreakdownSection,
  AssignmentContextCard,
  formatJsonLabel,
  asEvidenceList,
  IntegrityContextCard,
  MarkingEvidenceCard,
  RubricSection,
  SubmissionFileCard,
  toAssignmentDetailSubmission,
} from "./moderation-evidence-section.parts";

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
          <SubmissionFileCard
            hasSubmissionFile={hasSubmissionFile}
            onOpenSubmissionFile={() =>
              selectedCase.submission &&
              openSubmissionFile(toAssignmentDetailSubmission(selectedCase.submission), {
                source: "moderation_review_dialog",
                resourceType: "submission_file",
                moderationCaseId: selectedCase.moderationCase.id,
              })
            }
            selectedCase={selectedCase}
          />
          <AssignmentContextCard selectedCase={selectedCase} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Rubric</p>
          <RubricSection rubricItems={rubricItems} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MarkingEvidenceCard selectedCase={selectedCase} />
          <IntegrityContextCard formatJsonLabel={formatJsonLabel} integrityPayload={integrityPayload} selectedCase={selectedCase} />
        </div>

        <AIBreakdownSection aiBreakdown={aiBreakdown} />
      </CardContent>
    </Card>
  );
};
