import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";

import { useModerationDashboardScreenProps } from "../screen-props";
import { useModerationQueueState } from "../state";
import { useModerationActions } from "../workflows";

export const useModerationDashboardController = () => {
  const { user, profile, isDemo } = useAuth();
  const navigate = useNavigate();

  const queueState = useModerationQueueState({
    isDemo,
    userId: user?.id,
  });

  const actions = useModerationActions({
    bulkAssignableFilteredCases: queueState.bulkAssignableFilteredCases,
    bulkModeratorId: queueState.bulkModeratorId,
    feedbackDraft: queueState.feedbackDraft,
    fetchCases: queueState.fetchCases,
    isDemo,
    moderatorDrafts: queueState.moderatorDrafts,
    noteDraft: queueState.noteDraft,
    profileRole: profile?.role,
    scoreDraft: queueState.scoreDraft,
    selectedBulkApprovalCases: queueState.selectedBulkApprovalCases,
    selectedBulkCases: queueState.selectedBulkCases,
    selectedCase: queueState.selectedCase,
    selectedCaseId: queueState.selectedCaseId,
    selectedCaseIds: queueState.selectedCaseIds,
    setCases: queueState.setCases,
    setSelectedCaseId: queueState.setSelectedCaseId,
    setSelectedCaseIds: queueState.setSelectedCaseIds,
    userId: user?.id,
  });

  const openReleaseWorkflow = (assignmentId: string) => {
    navigate(`/dashboard/assignments/${assignmentId}?source=moderation&focus=release-ready`);
  };

  const screenProps = useModerationDashboardScreenProps({
    actions,
    openReleaseWorkflow,
    queueState,
    userId: user?.id,
  });

  return {
    loading: queueState.loading,
    screenProps,
  };
};
