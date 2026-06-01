import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { buildAssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/useAssignmentDetailScreenProps";
import { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import { useLecturerWorkflowController } from "@/pages/dashboard/assignment-detail/controllers/useLecturerWorkflowController";
import { useStudentWorkflowController } from "@/pages/dashboard/assignment-detail/controllers/useStudentWorkflowController";
import { useDemoAssignmentDetailData } from "@/pages/dashboard/assignment-detail/useDemoAssignmentDetailData";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { Profile } from "@/contexts/AuthContext";
import type { User } from "@supabase/supabase-js";

type DemoAssignmentDetailControllerArgs = {
  demoAssignmentSet: AssignmentDetailScreenProps["demoAssignmentSet"];
  hasUser: boolean;
  id: string | undefined;
  profile: Profile | null;
  role: string | null;
  user: User | null;
};

type DemoAssignmentDetailControllerResult = {
  assignment: ReturnType<typeof useDemoAssignmentDetailData>["assignment"];
  loadError: string | null;
  loading: boolean;
  navigate: ReturnType<typeof useNavigate>;
  refreshData: () => Promise<void>;
  screenProps: AssignmentDetailScreenProps | null;
};

export const useDemoAssignmentDetailController = ({
  demoAssignmentSet,
  hasUser,
  id,
  profile,
  role,
  user,
}: DemoAssignmentDetailControllerArgs): DemoAssignmentDetailControllerResult => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const backHref = searchParams.get("from") === "overview" ? "/demo/dashboard" : "/demo/dashboard/assignments";

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
  } = useDemoAssignmentDetailData({
    id,
    role,
    hasUser,
  });

  const currentUserId = user?.id ?? profile?.id ?? null;
  const currentUserEmail = user?.email ?? profile?.email ?? null;
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
    isDemo: true,
    profile,
    reloadSubmissions,
    submissions,
    user,
  });

  const { automatedActions, lecturerActions } = useLecturerWorkflowController({
    assignment,
    grades,
    integrityReviews,
    isDemo: true,
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
    screenProps: buildAssignmentDetailScreenProps({
      assignment,
      automatedActions,
      backHref,
      currentUserId,
      demoAssignmentSet,
      fileActions: studentWorkflow,
      grades,
      integrityCard: viewState.integrityCard,
      isDemo: true,
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
