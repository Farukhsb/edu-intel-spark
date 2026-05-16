import type { ComponentProps } from "react";
import type { NavigateFunction } from "react-router-dom";

import {
  AssignmentHeroCard,
  AssignmentReadinessCard,
} from "@/pages/dashboard/assignment-detail/ui";
import type { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import type { AssignmentDetailAssignment } from "@/pages/dashboard/assignment-detail/types";

interface BuildHeaderCardPropsArgs {
  assignment: AssignmentDetailAssignment;
  navigate: NavigateFunction;
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

export const buildHeroCardProps = ({
  assignment,
  navigate,
  viewState,
}: BuildHeaderCardPropsArgs): ComponentProps<typeof AssignmentHeroCard> => ({
  assignment,
  onBack: () => navigate("/dashboard/assignments"),
  summary: viewState.summary,
});

export const buildReadinessCardProps = ({
  viewState,
}: Pick<BuildHeaderCardPropsArgs, "viewState">): ComponentProps<typeof AssignmentReadinessCard> => ({
  isLecturer: viewState.isLecturer,
  workflowReadiness: viewState.workflowReadiness,
});
