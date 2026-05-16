export type AssignmentWorkflowTarget = {
  href: string;
  label: string;
};

export type AssignmentWorkflowStatsLike = {
  approved: number;
  graded: number;
  needsReview: number;
  released: number;
  total: number;
};

export const getAssignmentWorkflowTarget = ({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}): AssignmentWorkflowTarget => {
  switch (status) {
    case "under_review":
      return {
        href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=queue&focus=manual-review`,
        label: "Open manual review",
      };
    case "approved":
      return {
        href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=queue&focus=release-ready`,
        label: "Open release queue",
      };
    case "released":
      return {
        href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=queue&focus=released-results`,
        label: "Open released results",
      };
    case "submitted":
    case "ai_grading":
      return {
        href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=notification&focus=submission-review`,
        label: "Open review queue",
      };
    case "ai_graded":
    case "first_review":
    case "moderated":
    case "moderation_pending":
    case "moderation_in_progress":
    case "escalated":
      return {
        href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=notification&focus=ai-results`,
        label: "Open workflow",
      };
    default:
      return {
        href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}`,
        label: "Review",
      };
  }
};

export const getAssignmentWorkflowTargetFromStats = ({
  assignmentId,
  stats,
}: {
  assignmentId: string;
  stats: AssignmentWorkflowStatsLike | null | undefined;
}): AssignmentWorkflowTarget => {
  if (!stats) {
    return {
      href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}`,
      label: "Open Workflow",
    };
  }

  if (stats.needsReview > 0) {
    return {
      href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=notification&focus=submission-review`,
      label: "Open review queue",
    };
  }

  if (stats.approved > stats.released) {
    return {
      href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=queue&focus=release-ready`,
      label: "Open release queue",
    };
  }

  if (stats.graded > stats.approved) {
    return {
      href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=notification&focus=ai-results`,
      label: "Open workflow",
    };
  }

  if (stats.released > 0) {
    return {
      href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}?source=queue&focus=released-results`,
      label: "Open released results",
    };
  }

  return {
    href: `/dashboard/assignments/${encodeURIComponent(assignmentId)}`,
    label: "Open Workflow",
  };
};
