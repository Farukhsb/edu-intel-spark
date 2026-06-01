import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAssignmentDetailData } from "@/pages/dashboard/assignment-detail/useAssignmentDetailData";
import { buildLiveAssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/useAssignmentDetailScreenProps";
import { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import { useLecturerWorkflowController } from "@/pages/dashboard/assignment-detail/controllers/useLecturerWorkflowController";
import { useStudentWorkflowController } from "@/pages/dashboard/assignment-detail/controllers/useStudentWorkflowController";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { Profile } from "@/contexts/AuthContext";
import type { User } from "@supabase/supabase-js";

type AssignmentDetailControllerArgs = {
  hasUser: boolean;
  id: string | undefined;
  profile: Profile | null;
  role: string | null;
  user: User | null;
};

type AssignmentDetailControllerResult = {
  assignment: ReturnType<typeof useAssignmentDetailData>["assignment"];
  loadError: string | null;
  loading: boolean;
  navigate: ReturnType<typeof useNavigate>;
  refreshData: () => Promise<void>;
  screenProps: AssignmentDetailScreenProps | null;
};

export const useAssignmentDetailController = ({
  hasUser,
  id,
  profile,
  role,
  user,
}: AssignmentDetailControllerArgs): AssignmentDetailControllerResult => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const backHref = searchParams.get("from") === "overview" ? "/dashboard" : "/dashboard/assignments";

  const {
    assignment,
    submissions,
    grades,
    integrityReviews,
    moderationCases,
    loadError,
    loading,
    plagiarismFlags,
    plagiarismSummary,
    refreshData,
    reloadSubmissions,
    setModerationCases,
    setPlagiarismFlags,
    setPlagiarismSummary,
  } = useAssignmentDetailData({
    id,
    role,
    userId: user?.id,
    hasUser,
  });

  const currentUserId = user?.id ?? null;
  const currentUserEmail = user?.email ?? null;
  const [pinnedVisibleSubmissionIds, setPinnedVisibleSubmissionIds] = useState<string[]>([]);

  const viewState = useAssignmentDetailViewState({
    pinnedVisibleSubmissionIds,
    assignment,
    currentUserEmail,
    currentUserId,
    grades,
    navigate,
    plagiarismFlags,
    plagiarismSummary,
    role,
    search: location.search,
    submissions,
  });

  const studentWorkflow = useStudentWorkflowController({
    assignment,
    assignmentId: id ?? null,
    profile,
    reloadSubmissions,
    submissions,
    user,
  });

  const { automatedActions, lecturerActions } = useLecturerWorkflowController({
    assignment,
    grades,
    integrityReviews,
    moderationCases,
    reloadSubmissions,
    role,
    selected: viewState.selected,
    setModerationCases,
    setPlagiarismFlags,
    setPlagiarismSummary,
    setPinnedVisibleSubmissionIds,
    setSelected: viewState.setSelected,
    submissions,
    user,
  });

  if (!assignment) {
    return {
      assignment,
      loadError,
      loading,
      navigate,
      refreshData,
      screenProps: null,
    };
  }

  return {
    assignment,
    loadError,
    loading,
    navigate,
    refreshData,
    screenProps: buildLiveAssignmentDetailScreenProps({
      assignment,
      automatedActions,
      backHref,
      currentUserId,
      isDemo: false,
      fileActions: studentWorkflow,
      grades,
      integrityCard: viewState.integrityCard,
      lecturerActions,
      moderationCases,
      navigate,
      plagiarismFlags: viewState.visiblePlagiarismFlags,
      plagiarismSummary: viewState.visiblePlagiarismSummary,
      reloadSubmissions,
      submissions,
      viewState: {
        ...viewState,
      },
      searchPathname: location.pathname,
    }),
  };
};
