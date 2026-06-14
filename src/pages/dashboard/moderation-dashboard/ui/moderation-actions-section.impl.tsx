import { ModerationActionsButtonRow, ModerationActionsAssignmentCard, ModerationActionsDraftCard, type ModerationActionsSectionProps } from "./moderation-actions-section.parts";

export const ModerationActionsSection = (props: ModerationActionsSectionProps) => (
  <div className="space-y-4">
    <ModerationActionsAssignmentCard
      lecturers={props.lecturers}
      moderatorDrafts={props.moderatorDrafts}
      onAssignModerator={props.onAssignModerator}
      onModeratorDraftChange={props.onModeratorDraftChange}
      saving={props.saving}
      selectedCase={props.selectedCase}
      userId={props.userId}
    />
    <ModerationActionsDraftCard
      feedbackDraft={props.feedbackDraft}
      noteDraft={props.noteDraft}
      onFeedbackDraftChange={props.onFeedbackDraftChange}
      onNoteDraftChange={props.onNoteDraftChange}
      onScoreDraftChange={props.onScoreDraftChange}
      scoreDraft={props.scoreDraft}
      selectedCase={props.selectedCase}
      userId={props.userId}
    />
    <ModerationActionsButtonRow
      onSaveAction={props.onSaveAction}
      saving={props.saving}
      selectedCase={props.selectedCase}
      userId={props.userId}
    />
  </div>
);
