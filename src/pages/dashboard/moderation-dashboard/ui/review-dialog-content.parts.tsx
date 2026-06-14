import { Card, CardContent } from "@/components/ui/card";

import type { ModerationAction } from "@/lib/moderation";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";

import type { ModerationProfile } from "../types";
import { AuditHistorySection } from "./audit-history-section";
import { ModerationActionsSection } from "./moderation-actions-section";
import { ModerationEvidenceSection } from "./moderation-evidence-section";
import { ModerationHistorySection } from "./moderation-history-section";

export type ModerationReviewDialogContentProps = {
  feedbackDraft: string;
  lecturers: ModerationProfile[];
  moderatorDrafts: Record<string, string>;
  noteDraft: string;
  onAssignModerator: (item: ModerationCaseView) => void;
  onFeedbackDraftChange: (value: string) => void;
  onModeratorDraftChange: (caseId: string, value: string) => void;
  onNoteDraftChange: (value: string) => void;
  onSaveAction: (action: ModerationAction) => void;
  onScoreDraftChange: (value: string) => void;
  saving: boolean;
  scoreDraft: string;
  selectedCase: ModerationCaseView;
  userId?: string | null;
};

export const ModerationReviewMetrics = ({
  selectedCase,
  latestModeratorScore,
}: {
  latestModeratorScore: number | string;
  selectedCase: ModerationCaseView;
}) => (
  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
    {[
      { label: "AI score", value: selectedCase.grade?.ai_score ?? "-" },
      { label: "First marker", value: selectedCase.moderationCase.first_marker_score ?? selectedCase.grade?.lecturer_score ?? "-" },
      { label: "Moderator", value: latestModeratorScore },
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
);

export const ModerationReviewStatusCallout = ({
  selectedCase,
  disagreement,
  escalationSummary,
}: {
  disagreement: {
    label: string;
    baselineScore: number | null;
    feedbackChanged: boolean;
    moderatorScore: number | null;
  };
  escalationSummary:
    | {
        headline: string;
        resolutionState: string;
        escalationReason?: string | null;
      }
    | null;
  selectedCase: ModerationCaseView;
}) =>
  selectedCase.moderationCase.status === "moderated" ? (
    <div className="rounded-xl border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{disagreement.label}</p>
      <p className="mt-1 text-muted-foreground">
        First marker score: {disagreement.baselineScore ?? "-"} | Moderator score: {disagreement.moderatorScore ?? "-"}
      </p>
      <p className="mt-1 text-muted-foreground">Feedback change: {disagreement.feedbackChanged ? "Changed" : "No material change recorded"}</p>
    </div>
  ) : selectedCase.moderationCase.status === "escalated" && escalationSummary ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
      <p className="font-medium text-amber-900">{escalationSummary.headline}</p>
      <p className="mt-1 text-amber-900/80">{escalationSummary.resolutionState}</p>
      <p className="mt-2 text-muted-foreground">
        First marker score: {disagreement.baselineScore ?? "-"} | Moderator score: {disagreement.moderatorScore ?? "-"}
      </p>
      <p className="mt-1 text-muted-foreground">Feedback change: {disagreement.feedbackChanged ? "Changed" : "No material change recorded"}</p>
      {escalationSummary.escalationReason && <p className="mt-2 text-muted-foreground">Escalation reason: {escalationSummary.escalationReason}</p>}
    </div>
  ) : null;

export const ModerationReviewLowerGrid = ({
  selectedCase,
}: {
  selectedCase: ModerationCaseView;
}) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <ModerationHistorySection reviews={selectedCase.reviews} />
    <AuditHistorySection entries={selectedCase.auditLog.slice(0, 8)} />
  </div>
);

export const ModerationReviewMainGrid = (props: ModerationReviewDialogContentProps) => (
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
    <ModerationEvidenceSection selectedCase={props.selectedCase} />
    <ModerationActionsSection
      feedbackDraft={props.feedbackDraft}
      lecturers={props.lecturers}
      moderatorDrafts={props.moderatorDrafts}
      noteDraft={props.noteDraft}
      onAssignModerator={props.onAssignModerator}
      onFeedbackDraftChange={props.onFeedbackDraftChange}
      onModeratorDraftChange={props.onModeratorDraftChange}
      onNoteDraftChange={props.onNoteDraftChange}
      onSaveAction={props.onSaveAction}
      onScoreDraftChange={props.onScoreDraftChange}
      saving={props.saving}
      scoreDraft={props.scoreDraft}
      selectedCase={props.selectedCase}
      userId={props.userId}
    />
  </div>
);
