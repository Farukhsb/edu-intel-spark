import type { NavigateFunction } from "react-router-dom";

import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";

interface BuildFocusStatePropsArgs {
  navigate: NavigateFunction;
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

type FocusStateProps = Pick<
  AssignmentDetailScreenProps,
  | "assignmentNotificationFocusState"
  | "isLecturer"
  | "moderationReleaseFocus"
  | "moderationReleaseHandoffState"
  | "onClearModerationFocus"
  | "onClearNotificationFocus"
>;

export const buildFocusStateProps = ({
  navigate,
  viewState,
}: BuildFocusStatePropsArgs): FocusStateProps => ({
  assignmentNotificationFocusState: viewState.assignmentNotificationFocusState,
  isLecturer: viewState.isLecturer,
  moderationReleaseFocus: viewState.moderationReleaseFocus,
  moderationReleaseHandoffState: viewState.moderationReleaseHandoffState,
  onClearModerationFocus: () => {
    viewState.setStatusFilter("all");
    viewState.setSelected(new Set());
    navigate(viewState.searchPathname, { replace: true });
  },
  onClearNotificationFocus: () => {
    navigate(viewState.searchPathname, { replace: true });
  },
});
