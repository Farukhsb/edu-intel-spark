import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { buildDemoAssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/useAssignmentDetailScreenProps";
import { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state";
import { useDemoAutomatedAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows/useDemoAutomatedAssessmentActions";
import { useDemoLecturerAssessmentActions } from "@/pages/dashboard/assignment-detail/workflows/useDemoLecturerAssessmentActions";
import { useDemoSubmissionActions } from "@/pages/dashboard/assignment-detail/workflows/useDemoSubmissionActions";
import { useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows/useSubmissionFileActions";
import { useDemoAssignmentDetailData } from "@/pages/dashboard/assignment-detail/useDemoAssignmentDetailData";
import type { AssignmentDetailScreenProps } from "@/pages/dashboard/assignment-detail/ui";
import type { Profile } from "@/contexts/AuthContext";
import type { User } from "@supabase/supabase-js";

type DemoAssignmentDetailControllerArgs = {
  demoAssignmentSet: AssignmentDetailScreenProps["demoAssignmentSet"];
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
  } = useDemoAssignmentDetailData({
    id,
    role,
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

  const studentWorkflow = useDemoSubmissionActions({ assignmentId: id ?? null });
  const submissionFileActions = useSubmissionFileActions();
  const automatedActions = useDemoAutomatedAssessmentActions();
  const lecturerActions = useDemoLecturerAssessmentActions({
    assignment,
    grades,
    integrityReviews,
    moderationCases,
    reloadSubmissions,
    selected: viewState.selected,
    setModerationCases,
    setSelected: viewState.setSelected,
    submissions,
    user: user ? { id: user.id } : null,
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
    screenProps: buildDemoAssignmentDetailScreenProps({
      assignment,
      automatedActions,
      backHref,
      currentUserId,
      demoAssignmentSet,
      fileActions: {
        ...studentWorkflow,
        ...submissionFileActions,
      },
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
