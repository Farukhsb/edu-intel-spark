import { getLatestModeratorReview } from "@/lib/moderation";
import { getModerationDisagreementSummary, getModerationEscalationSummary } from "@/lib/moderationWorkflow";

import { ModerationReviewDialogContentProps, ModerationReviewLowerGrid, ModerationReviewMainGrid, ModerationReviewMetrics, ModerationReviewStatusCallout } from "./review-dialog-content.parts";

export const ModerationReviewDialogContent = ({
  selectedCase,
  ...props
}: ModerationReviewDialogContentProps) => {
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
    <div className="space-y-5 pt-2">
      <ModerationReviewMetrics
        latestModeratorScore={latestModeratorReview?.proposed_score ?? selectedCase.moderationCase.moderator_score ?? "-"}
        selectedCase={selectedCase}
      />
      <ModerationReviewStatusCallout
        disagreement={{
          label: disagreement.label,
          baselineScore: disagreement.baselineScore,
          feedbackChanged: disagreement.feedbackChanged,
          moderatorScore: disagreement.moderatorScore,
        }}
        escalationSummary={escalationSummary}
        selectedCase={selectedCase}
      />
      <ModerationReviewMainGrid selectedCase={selectedCase} {...props} />
      <ModerationReviewLowerGrid selectedCase={selectedCase} />
    </div>
  );
};
