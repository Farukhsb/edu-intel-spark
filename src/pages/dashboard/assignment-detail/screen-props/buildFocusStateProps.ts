import type { NavigateFunction } from "react-router-dom";

import { buildAbsoluteAppUrl, copyTextToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";

interface BuildFocusStatePropsArgs {
  navigate: NavigateFunction;
  searchPathname: string;
  viewState: ReturnType<typeof useAssignmentDetailViewState>;
}

type FocusStateProps = Pick<
  AssignmentDetailScreenProps,
  | "assignmentNotificationFocusState"
  | "isLecturer"
  | "moderationReleaseFocus"
  | "moderationReleaseHandoffState"
  | "onCopyModerationFocus"
  | "queueFocusState"
  | "onClearQueueFocus"
  | "onClearModerationFocus"
  | "onClearNotificationFocus"
>;

const copyFocusLink = async (path: string, successMessage: string) => {
  const copied = await copyTextToClipboard(buildAbsoluteAppUrl(path));
  if (copied) {
    toast.success(successMessage);
    return;
  }

  toast.error("Could not copy the focus link.");
};

export const buildFocusStateProps = ({
  navigate,
  searchPathname,
  viewState,
}: BuildFocusStatePropsArgs): FocusStateProps => ({
  assignmentNotificationFocusState: viewState.assignmentNotificationFocusState,
  isLecturer: viewState.isLecturer,
  moderationReleaseFocus: viewState.moderationReleaseFocus,
  moderationReleaseHandoffState: viewState.moderationReleaseHandoffState,
  onCopyModerationFocus: () => {
    void copyFocusLink(
      `${searchPathname}?source=moderation&focus=release-ready`,
      "Moderation handoff link copied.",
    );
  },
  queueFocusState: viewState.queueFocusState,
  onClearQueueFocus: () => {
    viewState.setStatusFilter("all");
    viewState.setSelected(new Set());
    navigate(searchPathname, { replace: true });
  },
  onClearModerationFocus: () => {
    viewState.setStatusFilter("all");
    viewState.setSelected(new Set());
    navigate(searchPathname, { replace: true });
  },
  onClearNotificationFocus: () => {
    navigate(searchPathname, { replace: true });
  },
});
