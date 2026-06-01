import type { ComponentProps } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import {
  AssignmentDemoBanner,
  AssignmentDemoSetCard,
  AssignmentDemoWorkflowCard,
  AssignmentFocusCard,
  AssignmentHeroCard,
  AssignmentIntegrityCard,
  AssignmentReadinessCard,
  AssignmentRubricCard,
} from "@/pages/dashboard/assignment-detail/ui/presentation";
import { DemoSubmissionReviewDialog } from "@/pages/dashboard/assignment-detail/ui/demo-review-dialog";
import { SubmissionListSection as DemoSubmissionListSection } from "@/pages/dashboard/assignment-detail/ui/demo-submission-list-section";
import { WorkflowActionsSection as DemoWorkflowActionsSection } from "@/pages/dashboard/assignment-detail/ui/demo-workflow-actions-section";
import type { DemoSubmissionReviewDialogProps } from "@/pages/dashboard/assignment-detail/ui/demo-review-dialog";
import type { WorkflowRubricCriterion } from "@/types/academic";

type DemoAssignmentSet = {
  label: string;
  name: string;
  reviewerSummary: string;
};

type FocusState = {
  description: string;
  title: string;
};

export interface DemoAssignmentDetailScreenProps {
  assignmentNotificationFocusState: FocusState | null;
  demoAssignmentSet: DemoAssignmentSet | null;
  integrityCardProps: ComponentProps<typeof AssignmentIntegrityCard> | null;
  isLecturer: boolean;
  moderationReleaseFocus: boolean;
  moderationReleaseHandoffState: FocusState;
  onCopyModerationFocus: () => void;
  queueFocusState: FocusState | null;
  onClearQueueFocus: () => void;
  onClearModerationFocus: () => void;
  onClearNotificationFocus: () => void;
  reviewDialogProps: DemoSubmissionReviewDialogProps;
  rubric: WorkflowRubricCriterion[];
  submissionListProps: ComponentProps<typeof DemoSubmissionListSection>;
  workflowActionsProps: ComponentProps<typeof DemoWorkflowActionsSection>;
  heroCardProps: ComponentProps<typeof AssignmentHeroCard>;
  readinessCardProps: ComponentProps<typeof AssignmentReadinessCard>;
}

export const DemoAssignmentDetailScreen = ({
  assignmentNotificationFocusState,
  demoAssignmentSet,
  integrityCardProps,
  isLecturer,
  moderationReleaseFocus,
  moderationReleaseHandoffState,
  onCopyModerationFocus,
  queueFocusState,
  onClearQueueFocus,
  onClearModerationFocus,
  onClearNotificationFocus,
  reviewDialogProps,
  rubric,
  submissionListProps,
  workflowActionsProps,
  heroCardProps,
  readinessCardProps,
}: DemoAssignmentDetailScreenProps) => (
  <div className="space-y-6 animate-fade-in">
    <AssignmentDemoBanner />
    {demoAssignmentSet && isLecturer && (
      <AssignmentDemoSetCard
        label={demoAssignmentSet.label}
        name={demoAssignmentSet.name}
        reviewerSummary={demoAssignmentSet.reviewerSummary}
      />
    )}
    {isLecturer && <AssignmentDemoWorkflowCard />}

    <AssignmentHeroCard {...heroCardProps} />

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
      <div className="space-y-6">
        <DemoWorkflowActionsSection {...workflowActionsProps} />
        <DemoSubmissionListSection {...submissionListProps} />

        {moderationReleaseFocus && isLecturer && (
          <AssignmentFocusCard
            clearLabel="Show all submissions"
            description={moderationReleaseHandoffState.description}
            onClear={onClearModerationFocus}
            onShare={onCopyModerationFocus}
            shareLabel="Copy focus link"
            testId="assignment-moderation-release-focus"
            title={moderationReleaseHandoffState.title}
          />
        )}

        {assignmentNotificationFocusState && isLecturer && (
          <AssignmentFocusCard
            clearLabel="Show all submissions"
            description={assignmentNotificationFocusState.description}
            onClear={onClearNotificationFocus}
            testId="assignment-notification-focus"
            title={assignmentNotificationFocusState.title}
          />
        )}

        {queueFocusState && isLecturer && (
          <AssignmentFocusCard
            clearLabel="Show all submissions"
            description={queueFocusState.description}
            onClear={onClearQueueFocus}
            testId="assignment-queue-focus"
            title={queueFocusState.title}
          />
        )}
        <AssignmentReadinessCard {...readinessCardProps} />
      </div>

      <div className="space-y-6">
        <Accordion type="multiple" className="space-y-4">
          {rubric.length > 0 ? (
            <AccordionItem value="rubric" className="rounded-xl border bg-background px-4 shadow-sm">
              <AccordionTrigger className="py-4 text-sm font-medium hover:no-underline">
                Rubric
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <AssignmentRubricCard rubric={rubric} />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          {integrityCardProps ? (
            <AccordionItem value="integrity" className="rounded-xl border bg-background px-4 shadow-sm">
              <AccordionTrigger className="py-4 text-sm font-medium hover:no-underline">
                Integrity Check Results
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <AssignmentIntegrityCard {...integrityCardProps} />
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </div>
    </div>

    {reviewDialogProps.open ? <DemoSubmissionReviewDialog {...reviewDialogProps} /> : null}
  </div>
);
