import { buildAssignmentPublishedNotification } from "@/lib/communications";
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

export const buildAssignmentPublishedNotificationRows = (input: {
  senderId: string;
  assignmentId: string;
  assignmentTitle: string;
  students: StudentNotificationProfile[];
}) =>
  input.students.map((student) => {
    const draft = buildAssignmentPublishedNotification({
      studentName: student.full_name || student.email || "Student",
      studentEmail: student.email,
      studentId: student.id,
      assignmentId: input.assignmentId,
      assignmentTitle: input.assignmentTitle,
    });

    return {
      sender_id: input.senderId,
      category: draft.category,
      recipient_name: draft.recipientName,
      recipient_email: draft.recipientEmail,
      recipient_id: draft.recipientId ?? null,
      subject: draft.subject,
      body: draft.body,
      related_student_id: draft.relatedStudentId ?? null,
      related_assignment_id: draft.relatedAssignmentId ?? null,
    };
  });

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
