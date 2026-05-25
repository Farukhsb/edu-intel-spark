import { useEffect, useMemo, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { getAssessmentSummary } from "@/lib/assessmentWorkflow";
import {
  buildIntegrityDisplayFlags,
  buildIntegrityDisplaySummary,
  deriveIntegrityCardPresentation,
  type IntegrityCardPresentation,
  type WorkflowReadinessState,
} from "@/pages/dashboard/assignment-detail/domain";
import { useAssignmentDetailReadinessState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailReadinessState";
import { useAssignmentDetailReportActions } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailReportActions";
import { useAssignmentDetailListState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailListState";
import { useStudentSubmissionState } from "@/pages/dashboard/assignment-detail/state/useStudentSubmissionState";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";
import type { AcademicIntegrityFlag } from "@/types/academic";

interface UseAssignmentDetailViewStateArgs {
  assignment: AssignmentDetailAssignment | null;
  currentUserEmail: string | null;
  currentUserId: string | null;
  grades: Record<string, Grade>;
  navigate: NavigateFunction;
  plagiarismFlags: AcademicIntegrityFlag[];
  plagiarismSummary: string | null;
  role: string | null;
  search: string;
  submissions: AssignmentDetailSubmission[];
}

interface UseAssignmentDetailViewStateResult {
  assignmentNotificationFocusState: ReturnType<typeof useAssignmentDetailListState>["assignmentNotificationFocusState"];
  currentStudentSubmission: AssignmentDetailSubmission | null;
  exportReviewedReports: () => void;
  filteredSubmissions: AssignmentDetailSubmission[];
  hasExistingSubmission: boolean;
  integrityCard: IntegrityCardPresentation;
  integrityRuntimeWarning: string | null;
  isLecturer: boolean;
  moderationReleaseFocus: boolean;
  moderationReleaseHandoffState: ReturnType<typeof useAssignmentDetailListState>["moderationReleaseHandoffState"];
  onClearIntegrityCard: () => void;
  notificationFocus: ReturnType<typeof useAssignmentDetailListState>["notificationFocus"];
  openReleasedResult: (submission: AssignmentDetailSubmission) => void;
  queueFocus: ReturnType<typeof useAssignmentDetailListState>["queueFocus"];
  queueFocusState: ReturnType<typeof useAssignmentDetailListState>["queueFocusState"];
  searchQuery: string;
  selected: Set<string>;
  selectedWorkflowGuidance: ReturnType<typeof useAssignmentDetailListState>["selectedWorkflowGuidance"];
  selectedWorkflowState: ReturnType<typeof useAssignmentDetailListState>["selectedWorkflowState"];
  visiblePlagiarismFlags: AcademicIntegrityFlag[];
  visiblePlagiarismSummary: string | null;
  setSearchQuery: ReturnType<typeof useAssignmentDetailListState>["setSearchQuery"];
  setSelected: ReturnType<typeof useAssignmentDetailListState>["setSelected"];
  setStatusFilter: ReturnType<typeof useAssignmentDetailListState>["setStatusFilter"];
  statusFilter: "all" | SubmissionStatus;
  studentSubmissionAvailability: ReturnType<typeof useStudentSubmissionState>["studentSubmissionAvailability"];
  summary: ReturnType<typeof getAssessmentSummary>;
  toggleAll: ReturnType<typeof useAssignmentDetailListState>["toggleAll"];
  toggleSelect: ReturnType<typeof useAssignmentDetailListState>["toggleSelect"];
  workflowLaneSummary: ReturnType<typeof useAssignmentDetailListState>["workflowLaneSummary"];
  workflowReadiness: WorkflowReadinessState;
}

export const useAssignmentDetailViewState = ({
  assignment,
  currentUserEmail,
  currentUserId,
  grades,
  navigate,
  plagiarismFlags,
  plagiarismSummary,
  role,
  search,
  submissions,
}: UseAssignmentDetailViewStateArgs): UseAssignmentDetailViewStateResult => {
  const summary = useMemo(() => getAssessmentSummary(submissions), [submissions]);
  const {
    assignmentNotificationFocusState,
    filteredSubmissions,
    isLecturer,
    moderationReleaseFocus,
    moderationReleaseHandoffState,
    notificationFocus,
    queueFocus,
    queueFocusState,
    searchQuery,
    selected,
    selectedWorkflowGuidance,
    selectedWorkflowState,
    setSearchQuery,
    setSelected,
    setStatusFilter,
    statusFilter,
    toggleAll,
    toggleSelect,
    workflowLaneSummary,
  } = useAssignmentDetailListState({
    role,
    search,
    submissions,
  });

  const visiblePlagiarismFlags = useMemo(
    () => buildIntegrityDisplayFlags(plagiarismFlags),
    [plagiarismFlags],
  );
  const visiblePlagiarismSummary = useMemo(
    () => buildIntegrityDisplaySummary(visiblePlagiarismFlags, plagiarismSummary ?? ""),
    [visiblePlagiarismFlags, plagiarismSummary],
  );

  const integrityCardSignature = useMemo(
    () =>
      JSON.stringify({
        flagKeys: visiblePlagiarismFlags.map((flag) => [
          flag.submission_a_id,
          flag.submission_b_id,
          flag.reason,
          flag.total_risk_score ?? flag.similarity_score,
        ]),
        summary: visiblePlagiarismSummary ?? "",
      }),
    [visiblePlagiarismFlags, visiblePlagiarismSummary],
  );
  const [dismissedIntegrityCardSignature, setDismissedIntegrityCardSignature] = useState<string | null>(null);

  useEffect(() => {
    if (dismissedIntegrityCardSignature && dismissedIntegrityCardSignature !== integrityCardSignature) {
      setDismissedIntegrityCardSignature(null);
    }
  }, [dismissedIntegrityCardSignature, integrityCardSignature]);

  const integrityCard = useMemo(() => {
    const basePresentation = deriveIntegrityCardPresentation({
      flags: visiblePlagiarismFlags,
      summary: visiblePlagiarismSummary ?? "",
    });

    return {
      ...basePresentation,
      shouldShowCard:
        basePresentation.shouldShowCard && dismissedIntegrityCardSignature !== integrityCardSignature,
    };
  }, [
    dismissedIntegrityCardSignature,
    integrityCardSignature,
    visiblePlagiarismFlags,
    visiblePlagiarismSummary,
  ]);

  const {
    currentStudentSubmission,
    hasExistingSubmission,
    studentSubmissionAvailability,
  } = useStudentSubmissionState({
    assignment,
    currentUserEmail,
    currentUserId,
    isLecturer,
    submissions,
  });

  const { integrityRuntimeWarning, workflowReadiness } = useAssignmentDetailReadinessState({
    currentStudentSubmissionStatus: currentStudentSubmission?.status ?? null,
    isLecturer,
    submissions,
  });

  const { exportReviewedReports, openReleasedResult } = useAssignmentDetailReportActions({
    assignment,
    grades,
    navigate,
    submissions,
  });

  return {
    assignmentNotificationFocusState,
    currentStudentSubmission,
    exportReviewedReports,
    filteredSubmissions,
    hasExistingSubmission,
    integrityCard,
    integrityRuntimeWarning,
    isLecturer,
    moderationReleaseFocus,
    moderationReleaseHandoffState,
    notificationFocus,
    onClearIntegrityCard: () => {
      setDismissedIntegrityCardSignature(integrityCardSignature);
    },
    openReleasedResult,
    queueFocus,
    queueFocusState,
    searchQuery,
    selected,
    selectedWorkflowGuidance,
    selectedWorkflowState,
    visiblePlagiarismFlags,
    visiblePlagiarismSummary,
    setSearchQuery,
    setSelected,
    setStatusFilter,
    statusFilter,
    studentSubmissionAvailability,
    summary,
    toggleAll,
    toggleSelect,
    workflowLaneSummary,
    workflowReadiness,
  };
};
