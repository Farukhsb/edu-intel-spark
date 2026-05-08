import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { getSelectedWorkflowActionState } from "@/lib/assessmentWorkflow";
import { parseAssignmentDetailSearchState } from "@/lib/schemas/navigation";
import {
  getAssignmentNotificationFocusState,
  getModerationReleaseHandoffState,
} from "@/pages/dashboard/assignment-detail/domain";
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
  const isLecturer = role === "lecturer";

  const { moderationReleaseFocus, notificationFocus: assignmentNotificationFocus } = useMemo(
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

  const notificationFocusedSubmissionIds = assignmentNotificationFocusState?.visibleSubmissionIds;

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) => {
        const matchesNotificationFocus =
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
    [notificationFocusedSubmissionIds, searchQuery, statusFilter, submissions],
  );

  useEffect(() => {
    if (!moderationReleaseFocus || !isLecturer) return;

    setStatusFilter(moderationReleaseHandoffState.statusFilter);
    setSelected(new Set(moderationReleaseHandoffState.selectedSubmissionIds));
  }, [isLecturer, moderationReleaseFocus, moderationReleaseHandoffState]);

  useEffect(() => {
    if (!assignmentNotificationFocusState || !isLecturer) return;

    setStatusFilter(assignmentNotificationFocusState.statusFilter);
    setSelected(new Set(assignmentNotificationFocusState.selectedSubmissionIds));
  }, [assignmentNotificationFocusState, isLecturer]);

  const selectedWorkflowState = useMemo(() => {
    const selectedStatuses = submissions
      .filter((submission) => selected.has(submission.id))
      .map((submission) => submission.status);
    return getSelectedWorkflowActionState(selectedStatuses);
  }, [selected, submissions]);

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

  return {
    assignmentNotificationFocusState,
    filteredSubmissions,
    isLecturer,
    moderationReleaseFocus,
    moderationReleaseHandoffState,
    searchQuery,
    selected,
    selectedWorkflowState,
    setSearchQuery,
    setSelected,
    setStatusFilter,
    statusFilter,
    toggleAll,
    toggleSelect,
  };
};
