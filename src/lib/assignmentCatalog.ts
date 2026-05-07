import {
  buildAssignmentPublishedNotification,
  type DraftCommunicationMessage,
} from "@/lib/communications";
import {
  canReleaseStatus,
  isGradedWorkflowStatus,
  isReviewQueueStatus,
  isStudentGradeVisible,
} from "@/lib/assessmentWorkflow";
import { isAssignmentDueSoon } from "@/lib/assignmentVisibility";

export interface AssignmentCatalogItem {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  lecturer_id: string;
  max_score: number;
  due_date: string | null;
  status: "draft" | "published" | "closed";
  created_at: string;
  rubric: unknown[] | null;
  cohorts: string[];
  departments: string[];
  target_cohorts: string[];
  target_departments: string[];
}

export interface StudentNotificationProfile {
  id: string;
  cohort_id: string | null;
  department_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

export interface AssignmentSubmissionLike {
  id: string;
  assignment_id: string;
  status: string;
}

export interface AssignmentSubmissionStats {
  total: number;
  graded: number;
  approved: number;
  released: number;
  needsReview: number;
}

export interface AssignmentCatalogReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const normalizeAssignment = <
  T extends Partial<AssignmentCatalogItem> &
    Pick<
      AssignmentCatalogItem,
      "id" | "title" | "lecturer_id" | "max_score" | "status" | "created_at"
    >,
>(
  assignment: T,
): AssignmentCatalogItem => ({
  id: assignment.id,
  title: assignment.title,
  description: assignment.description ?? null,
  module_code: assignment.module_code ?? null,
  lecturer_id: assignment.lecturer_id,
  max_score: assignment.max_score,
  due_date: assignment.due_date ?? null,
  status: assignment.status,
  created_at: assignment.created_at,
  rubric: assignment.rubric ?? [],
  cohorts: assignment.cohorts ?? [],
  departments: assignment.departments ?? [],
  target_cohorts: assignment.target_cohorts ?? [],
  target_departments: assignment.target_departments ?? [],
});

export const buildAssignmentPublishedNotifications = (input: {
  assignmentId: string;
  assignmentTitle: string;
  students: StudentNotificationProfile[];
}): DraftCommunicationMessage[] =>
  input.students.map((student) => {
    return buildAssignmentPublishedNotification({
      studentName: student.full_name || student.email || "Student",
      studentEmail: student.email,
      studentId: student.id,
      assignmentId: input.assignmentId,
      assignmentTitle: input.assignmentTitle,
    });
  });

export const buildAssignmentPublishedNotificationRows = (input: {
  senderId: string;
  assignmentId: string;
  assignmentTitle: string;
  students: StudentNotificationProfile[];
}) =>
  buildAssignmentPublishedNotifications({
    assignmentId: input.assignmentId,
    assignmentTitle: input.assignmentTitle,
    students: input.students,
  }).map((draft) => ({
    sender_id: input.senderId,
    category: draft.category,
    recipient_name: draft.recipientName,
    recipient_email: draft.recipientEmail,
    recipient_id: draft.recipientId ?? null,
    subject: draft.subject,
    body: draft.body,
    related_student_id: draft.relatedStudentId ?? null,
    related_assignment_id: draft.relatedAssignmentId ?? null,
  }));

export const buildAssignmentSubmissionStats = (
  assignments: AssignmentCatalogItem[],
  submissions: AssignmentSubmissionLike[],
) => {
  const statsMap: Record<string, AssignmentSubmissionStats> = {};

  for (const assignment of assignments) {
    const relatedSubs = submissions.filter((submission) => submission.assignment_id === assignment.id);
    statsMap[assignment.id] = {
      total: relatedSubs.length,
      graded: relatedSubs.filter((submission) => isGradedWorkflowStatus(submission.status)).length,
      approved: relatedSubs.filter(
        (submission) => canReleaseStatus(submission.status) || isStudentGradeVisible(submission.status),
      ).length,
      released: relatedSubs.filter((submission) => isStudentGradeVisible(submission.status)).length,
      needsReview: relatedSubs.filter((submission) => isReviewQueueStatus(submission.status)).length,
    };
  }

  return statsMap;
};

export const filterAssignments = ({
  assignments,
  searchQuery,
  statusFilter,
  role,
  isPendingReviewView,
  submissionStats,
}: {
  assignments: AssignmentCatalogItem[];
  searchQuery: string;
  statusFilter: "all" | AssignmentCatalogItem["status"];
  role: string | null | undefined;
  isPendingReviewView: boolean;
  submissionStats: Record<string, AssignmentSubmissionStats>;
}) =>
  assignments.filter((assignment) => {
    const matchesSearch =
      !searchQuery ||
      [assignment.title, assignment.module_code, assignment.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStatus =
      statusFilter === "all"
        ? role === "lecturer"
          ? assignment.status !== "closed"
          : true
        : assignment.status === statusFilter;

    const reviewCount = submissionStats[assignment.id]?.needsReview ?? 0;
    const matchesQueue = !isPendingReviewView || reviewCount > 0;

    return matchesSearch && matchesStatus && matchesQueue;
  });

export const sortAssignmentsForView = ({
  assignments,
  isPendingReviewView,
  submissionStats,
}: {
  assignments: AssignmentCatalogItem[];
  isPendingReviewView: boolean;
  submissionStats: Record<string, AssignmentSubmissionStats>;
}) =>
  [...assignments].sort((left, right) => {
    if (!isPendingReviewView) return 0;
    return (submissionStats[right.id]?.needsReview ?? 0) - (submissionStats[left.id]?.needsReview ?? 0);
  });

export const getAssignmentOverviewStats = (assignments: AssignmentCatalogItem[]) => ({
  drafts: assignments.filter((assignment) => assignment.status === "draft").length,
  published: assignments.filter((assignment) => assignment.status === "published").length,
  dueSoon: assignments.filter((assignment) => isAssignmentDueSoon(assignment.due_date)).length,
});

export const getLecturerAssignmentCatalogReadiness = ({
  assignments,
  submissionStats,
}: {
  assignments: AssignmentCatalogItem[];
  submissionStats: Record<string, AssignmentSubmissionStats>;
}): AssignmentCatalogReadiness => {
  const published = assignments.filter((assignment) => assignment.status === "published").length;
  const drafts = assignments.filter((assignment) => assignment.status === "draft").length;
  const dueSoon = assignments.filter((assignment) => isAssignmentDueSoon(assignment.due_date)).length;
  const reviewQueueAssignments = assignments
    .map((assignment) => ({
      assignment,
      needsReview: submissionStats[assignment.id]?.needsReview ?? 0,
    }))
    .filter((entry) => entry.needsReview > 0)
    .sort((left, right) => right.needsReview - left.needsReview);
  const highestReviewQueue = reviewQueueAssignments[0];

  return {
    postureLabel:
      reviewQueueAssignments.length > 0
        ? "Active marking position"
        : drafts > 0
          ? "Draft preparation position"
          : published > 0
            ? "Live delivery position"
            : "Setup position",
    likelyChallenge:
      highestReviewQueue
        ? `${highestReviewQueue.assignment.title} has ${highestReviewQueue.needsReview} submission${highestReviewQueue.needsReview === 1 ? "" : "s"} needing review`
        : dueSoon > 0
          ? `${dueSoon} assignment${dueSoon === 1 ? "" : "s"} due within 7 days`
          : drafts > 0
            ? `${drafts} draft assignment${drafts === 1 ? "" : "s"} not yet published`
            : "No assignment pressure point yet",
    bestNextAction:
      highestReviewQueue
        ? "Open the review queue and clear grading, approval, or release blockers"
        : drafts > 0
          ? "Publish the next draft assignment when the brief and rubric are ready"
          : published > 0
            ? "Monitor live assignment progress and upcoming deadlines"
            : "Create the first assignment workflow",
  };
};

export const getStudentAssignmentCatalogReadiness = ({
  assignments,
  studentWorkflow,
}: {
  assignments: AssignmentCatalogItem[];
  studentWorkflow: Record<
    string,
    {
      assignmentId: string;
      submissionId: string;
      status: string;
      submittedAt: string;
    }
  >;
}): AssignmentCatalogReadiness => {
  const visibleAssignments = assignments.filter((assignment) => assignment.status === "published");
  const releasedAssignments = visibleAssignments.filter((assignment) =>
    isStudentGradeVisible(studentWorkflow[assignment.id]?.status ?? ""),
  );
  const moderationAssignments = visibleAssignments.filter((assignment) =>
    ["moderation_pending", "moderation_in_progress", "escalated"].includes(studentWorkflow[assignment.id]?.status ?? ""),
  );
  const readyToSubmit = visibleAssignments.filter((assignment) => !studentWorkflow[assignment.id]).length;
  const firstReleased = releasedAssignments[0];

  return {
    postureLabel:
      releasedAssignments.length > 0
        ? "Released result position"
        : moderationAssignments.length > 0
          ? "Moderation wait position"
          : readyToSubmit > 0
            ? "Submission window position"
            : "Assessment in progress position",
    likelyChallenge:
      firstReleased
        ? `${firstReleased.title} has a released result ready to review`
        : moderationAssignments.length > 0
          ? `${moderationAssignments.length} assignment${moderationAssignments.length === 1 ? "" : "s"} still in moderation`
          : readyToSubmit > 0
            ? `${readyToSubmit} published assignment${readyToSubmit === 1 ? "" : "s"} ready for submission`
            : "No assignment pressure point yet",
    bestNextAction:
      firstReleased
        ? "Open the released result and review the feedback summary"
        : moderationAssignments.length > 0
          ? "Track moderation outcomes and wait for final release"
          : readyToSubmit > 0
            ? "Open the next assignment and submit your work"
            : "Monitor the assignment workflow for the next update",
  };
};
