import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getLecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";
import type {
  LecturerOverviewAssignment,
  LecturerOverviewAtRiskSummary,
  LecturerOverviewPipelineStage,
  LecturerOverviewQueueFocus,
  LecturerOverviewRecentSubmission,
  LecturerOverviewState,
  LecturerOverviewStats,
  LecturerOverviewWorkflowTarget,
} from "./types";
import { DEMO_ASSIGNMENTS, DEMO_PIPELINE, DEMO_RECENT, DEMO_STATS, DEMO_TOP_AT_RISK } from "./demoData";

const getOverviewQueueActionLabel = (status: string) => {
  if (
    [
      "submitted",
      "ai_grading",
      "ai_graded",
      "first_review",
      "moderation_pending",
      "moderation_in_progress",
      "escalated",
      "under_review",
    ].includes(status)
  ) {
    return "Open review queue";
  }

  return "Continue workflow";
};

export const useDemoLecturerOverviewController = () => {
  const { profile } = useAuth();
  const [stats] = useState<LecturerOverviewStats>(DEMO_STATS);
  const [recent] = useState<LecturerOverviewRecentSubmission[]>(DEMO_RECENT);
  const [pipeline] = useState<LecturerOverviewPipelineStage[]>(DEMO_PIPELINE);
  const [topAtRiskStudents] = useState<LecturerOverviewAtRiskSummary[]>(DEMO_TOP_AT_RISK);
  const [assignments] = useState<LecturerOverviewAssignment[]>(DEMO_ASSIGNMENTS);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [loadWarning] = useState<string | null>(null);

  const pendingRecentSubmissions = useMemo(
    () =>
      recent.filter((submission) =>
        [
          "submitted",
          "ai_grading",
          "ai_graded",
          "first_review",
          "moderation_pending",
          "moderation_in_progress",
          "escalated",
          "under_review",
        ].includes(submission.status),
      ),
    [recent],
  );

  const leadPendingAssignment = useMemo(() => {
    const pendingByAssignment = pendingRecentSubmissions.reduce<
      Record<
        string,
        {
          assignmentId: string;
          title: string;
          count: number;
          targetHref: string;
          targetStatus: string;
        }
      >
    >((accumulator, submission) => {
      const current = accumulator[submission.assignment_id] ?? {
        assignmentId: submission.assignment_id,
        title: submission.assignment_title,
        count: 0,
        targetHref: submission.workflowHref,
        targetStatus: submission.status,
      };
      current.count += 1;
      accumulator[submission.assignment_id] = current;
      return accumulator;
    }, {});

    return Object.values(pendingByAssignment).sort((a, b) => b.count - a.count)[0] ?? null;
  }, [pendingRecentSubmissions]);

  const leadPendingAssignmentTitle = leadPendingAssignment?.title ?? null;
  const readiness = getLecturerOverviewReadiness({
    pendingCount: stats.pendingCount,
    atRiskCount: stats.atRisk,
    assignmentCount: stats.assignmentCount,
    leadPendingAssignmentTitle,
  });

  const heroSummary = useMemo(() => {
    if (stats.pendingCount > 0 && stats.atRisk > 0) {
      return "Focus today: clear the review queue and support students showing early risk.";
    }
    if (stats.pendingCount > 0) {
      return "Focus today: keep the review queue moving so feedback does not stall.";
    }
    if (stats.atRisk > 0) {
      return "Focus today: check students below target and follow up before pressure builds.";
    }
    return "Focus today: scan active teaching work and keep release-ready submissions moving.";
  }, [stats.pendingCount, stats.atRisk]);

  const primaryWorkflowTarget = useMemo<LecturerOverviewWorkflowTarget | null>(() => {
    if (!leadPendingAssignment) return null;

    return {
      href: leadPendingAssignment.targetHref,
      label: getOverviewQueueActionLabel(leadPendingAssignment.targetStatus),
    };
  }, [leadPendingAssignment]);

  const queueFocus = useMemo<LecturerOverviewQueueFocus>(() => {
    if (stats.pendingCount > 0) {
      return {
        label: leadPendingAssignment ? leadPendingAssignment.title : "Review queue",
        detail: leadPendingAssignment
          ? `${leadPendingAssignment.count} pending submission${leadPendingAssignment.count === 1 ? "" : "s"} are currently stacking up here.`
          : `${stats.pendingCount} submission${stats.pendingCount === 1 ? "" : "s"} are waiting in the review queue.`,
      };
    }

    if (stats.atRisk > 0) {
      return {
        label: "Support pressure",
        detail: `${stats.atRisk} student${stats.atRisk === 1 ? "" : "s"} currently sit below target and may need intervention.`,
      };
    }

    return {
      label: "Live teaching scope",
      detail: `${stats.assignmentCount} active assignment${stats.assignmentCount === 1 ? "" : "s"} and ${stats.activeStudents} active student${stats.activeStudents === 1 ? "" : "s"} are in view.`,
    };
  }, [leadPendingAssignment, stats.activeStudents, stats.assignmentCount, stats.atRisk, stats.pendingCount]);

  return {
    profile,
    state: {
      loading,
      error,
      loadWarning,
      assignments,
      stats,
      recent,
      pipeline,
      readiness,
      topAtRiskStudents,
      heroSummary,
      primaryWorkflowTarget,
      queueFocus,
    } satisfies LecturerOverviewState,
    actions: {
      reload: () => undefined,
    },
  };
};
