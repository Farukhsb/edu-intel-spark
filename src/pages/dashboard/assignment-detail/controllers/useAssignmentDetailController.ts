import { useLocation, useNavigate } from "react-router-dom";

import { useAssignmentDetailData } from "@/pages/dashboard/assignment-detail/useAssignmentDetailData";
import { buildAssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/useAssignmentDetailScreenProps";
import { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import { useLecturerWorkflowController } from "@/pages/dashboard/assignment-detail/controllers/useLecturerWorkflowController";
import { useStudentWorkflowController } from "@/pages/dashboard/assignment-detail/controllers/useStudentWorkflowController";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { Profile } from "@/contexts/AuthContext";
import type { User } from "@supabase/supabase-js";

type AssignmentDetailControllerArgs = {
  demoAssignmentSet: AssignmentDetailScreenProps["demoAssignmentSet"];
  hasUser: boolean;
  id: string | undefined;
  isDemo: boolean;
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
  demoAssignmentSet,
  hasUser,
  id,
  isDemo,
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
    isDemo,
    role,
    userId: user?.id,
    hasUser,
  });

  const currentUserId = user?.id ?? (isDemo ? profile?.id ?? null : null);
  const currentUserEmail = user?.email ?? (isDemo ? profile?.email ?? null : null);

  const viewState = useAssignmentDetailViewState({
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
    isDemo,
    profile,
    reloadSubmissions,
    submissions,
    user,
  });

  const { automatedActions, lecturerActions } = useLecturerWorkflowController({
    assignment,
    grades,
    integrityReviews,
    isDemo,
    moderationCases,
    reloadSubmissions,
    role,
    selected: viewState.selected,
    setModerationCases,
    setPlagiarismFlags,
    setPlagiarismSummary,
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
      isDemo,
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
