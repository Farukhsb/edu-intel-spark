import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ModerationReviewDialogContent } from "./review-dialog-content";

import type { ModerationProfile } from "../types";
import type { ModerationAction } from "@/lib/moderation";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";

export type ModerationReviewDialogProps = {
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
}: ModerationReviewDialogProps) => {
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

        {selectedCase ? (
          <ModerationReviewDialogContent
            feedbackDraft={feedbackDraft}
            lecturers={lecturers}
            moderatorDrafts={moderatorDrafts}
            noteDraft={noteDraft}
            onAssignModerator={onAssignModerator}
            onFeedbackDraftChange={onFeedbackDraftChange}
            onModeratorDraftChange={onModeratorDraftChange}
            onNoteDraftChange={onNoteDraftChange}
            onSaveAction={onSaveAction}
            onScoreDraftChange={onScoreDraftChange}
            saving={saving}
            scoreDraft={scoreDraft}
            selectedCase={selectedCase}
            userId={userId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
