import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import {
  getLecturerSelectionGuidance,
  getLecturerWorkflowLaneSummary,
  getSelectedWorkflowActionState,
} from "@/lib/assessmentWorkflow";
import { parseAssignmentDetailSearchState } from "@/lib/schemas/navigation";
import {
  getAssignmentNotificationFocusState,
  getModerationReleaseHandoffState,
} from "@/pages/dashboard/assignment-detail/domain";
import type {
  AssignmentNotificationFocusValue,
  AssignmentQueueFocusValue,
} from "@/lib/schemas/navigation";
import type {
  AssignmentDetailSubmission,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";

interface UseAssignmentDetailListStateArgs {
  role: string | null;
  search: string;
  submissions: AssignmentDetailSubmission[];
}

interface UseAssignmentDetailListStateResult {
  assignmentNotificationFocusState: ReturnType<typeof getAssignmentNotificationFocusState> | null;
  filteredSubmissions: AssignmentDetailSubmission[];
  isLecturer: boolean;
  moderationReleaseFocus: boolean;
  moderationReleaseHandoffState: ReturnType<typeof getModerationReleaseHandoffState>;
  notificationFocus: AssignmentNotificationFocusValue | null;
  queueFocus: AssignmentQueueFocusValue | null;
  queueFocusState: {
    description: string;
    selectedSubmissionIds: string[];
    statusFilter: "all" | SubmissionStatus;
    title: string;
  } | null;
  selectedWorkflowGuidance: ReturnType<typeof getLecturerSelectionGuidance>;
  workflowLaneSummary: ReturnType<typeof getLecturerWorkflowLaneSummary>;
  searchQuery: string;
  selected: Set<string>;
  selectedWorkflowState: ReturnType<typeof getSelectedWorkflowActionState>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  setStatusFilter: Dispatch<SetStateAction<"all" | SubmissionStatus>>;
  statusFilter: "all" | SubmissionStatus;
  toggleAll: () => void;
  toggleSelect: (submissionId: string) => void;
}

export const useAssignmentDetailListState = ({
  role,
  search,
  submissions,
}: UseAssignmentDetailListStateArgs): UseAssignmentDetailListStateResult => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const [manualStatusFilterOverride, setManualStatusFilterOverride] = useState(false);
  const isLecturer = role === "lecturer";

  const {
    moderationReleaseFocus,
    notificationFocus: assignmentNotificationFocus,
    queueFocus,
  } = useMemo(
    () => parseAssignmentDetailSearchState(new URLSearchParams(search)),
    [search],
  );

  const moderationReleaseHandoffState = useMemo(
    () => getModerationReleaseHandoffState(submissions),
    [submissions],
  );

  const assignmentNotificationFocusState = useMemo(
    () => getAssignmentNotificationFocusState(assignmentNotificationFocus, submissions),
    [assignmentNotificationFocus, submissions],
  );
  const queueFocusState = useMemo(() => {
    if (!queueFocus) return null;

    const buildState = (
      nextStatusFilter: "all" | SubmissionStatus,
      title: string,
      description: string,
    ) => ({
      statusFilter: nextStatusFilter,
      title,
      description,
      selectedSubmissionIds: submissions
        .filter((submission) => submission.status === nextStatusFilter)
        .map((submission) => submission.id),
    });

    if (queueFocus === "manual-review") {
      return buildState(
        "under_review",
        "Opened from manual review queue",
        "The submission list is focused on AI-bypassed work that still needs a lecturer-owned score and feedback.",
      );
    }

    if (queueFocus === "release-ready") {
      return buildState(
        "approved",
        "Opened from release-ready queue",
        "The submission list is focused on approved submissions that are ready to release to students.",
      );
    }

    return buildState(
      "released",
      "Opened from released results queue",
      "The submission list is focused on submissions that already moved through moderation and were released to students.",
    );
  }, [queueFocus, submissions]);

  const notificationFocusedSubmissionIds = assignmentNotificationFocusState?.visibleSubmissionIds;

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) => {
        const matchesNotificationFocus =
          manualStatusFilterOverride ||
          !notificationFocusedSubmissionIds ||
          notificationFocusedSubmissionIds.includes(submission.id);
        const matchesSearch =
          !searchQuery ||
          [submission.student_name, submission.student_email, submission.file_name]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        const matchesStatus = statusFilter === "all" || submission.status === statusFilter;
        return matchesNotificationFocus && matchesSearch && matchesStatus;
      }),
    [manualStatusFilterOverride, notificationFocusedSubmissionIds, searchQuery, statusFilter, submissions],
  );

  useEffect(() => {
    if (!moderationReleaseFocus || !isLecturer) return;

    setManualStatusFilterOverride(false);
    setStatusFilter(moderationReleaseHandoffState.statusFilter);
    setSelected(new Set(moderationReleaseHandoffState.selectedSubmissionIds));
  }, [isLecturer, moderationReleaseFocus, moderationReleaseHandoffState]);

  useEffect(() => {
    if (!queueFocusState || !isLecturer) return;

    setManualStatusFilterOverride(false);
    setStatusFilter(queueFocusState.statusFilter);
    setSelected(new Set(queueFocusState.selectedSubmissionIds));
  }, [isLecturer, queueFocusState]);

  useEffect(() => {
    if (!assignmentNotificationFocusState || !isLecturer) return;

    setManualStatusFilterOverride(false);
    setStatusFilter(assignmentNotificationFocusState.statusFilter);
    setSelected(new Set(assignmentNotificationFocusState.selectedSubmissionIds));
  }, [assignmentNotificationFocusState, isLecturer]);

  const selectedWorkflowState = useMemo(() => {
    const selectedStatuses = submissions
      .filter((submission) => selected.has(submission.id))
      .map((submission) => submission.status);
    return getSelectedWorkflowActionState(selectedStatuses);
  }, [selected, submissions]);

  const selectedWorkflowGuidance = useMemo(() => {
    const selectedStatuses = submissions
      .filter((submission) => selected.has(submission.id))
      .map((submission) => submission.status);
    return getLecturerSelectionGuidance(selectedStatuses);
  }, [selected, submissions]);

  const workflowLaneSummary = useMemo(
    () => getLecturerWorkflowLaneSummary(submissions.map((submission) => submission.status)),
    [submissions],
  );

  const toggleSelect = (submissionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredSubmissions.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredSubmissions.map((submission) => submission.id)));
  };

  const handleSetStatusFilter: Dispatch<SetStateAction<"all" | SubmissionStatus>> = (value) => {
    setManualStatusFilterOverride(true);
    setStatusFilter((current) => (typeof value === "function" ? value(current) : value));
  };

  return {
    assignmentNotificationFocusState,
    filteredSubmissions,
    isLecturer,
    moderationReleaseFocus,
    moderationReleaseHandoffState,
    notificationFocus: assignmentNotificationFocus,
    queueFocus,
    queueFocusState,
    selectedWorkflowGuidance,
    workflowLaneSummary,
    searchQuery,
    selected,
    selectedWorkflowState,
    setSearchQuery,
    setSelected,
    setStatusFilter: handleSetStatusFilter,
    statusFilter,
    toggleAll,
    toggleSelect,
  };
};
