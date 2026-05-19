import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { getAssignmentWorkflowTarget } from "@/lib/assignmentWorkflowNavigation";
import { isGradedWorkflowStatus, isReviewQueueStatus } from "@/lib/assessmentWorkflow";
import { safeToLocaleDate } from "@/lib/date";
import { getLecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";
import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";

import type {
  LecturerOverviewPipelineStage,
  LecturerOverviewQueueFocus,
  LecturerOverviewRecentSubmission,
  LecturerOverviewState,
  LecturerOverviewStats,
  LecturerOverviewWorkflowTarget,
} from "./types";

const ASSIGNMENT_FIELDS = "id, title, max_score";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, file_name, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

const EMPTY_STATS: LecturerOverviewStats = {
  totalSubmissions: 0,
  gradedCount: 0,
  pendingCount: 0,
  avgScore: null,
  avgScoreScale: null,
  activeStudents: 0,
  assignmentCount: 0,
  onTarget: 0,
  atRisk: 0,
};

const DEMO_STATS: LecturerOverviewStats = {
  totalSubmissions: 42,
  gradedCount: 35,
  pendingCount: 7,
  avgScore: 64.3,
  avgScoreScale: 100,
  activeStudents: 28,
  assignmentCount: 5,
  onTarget: 22,
  atRisk: 6,
};

const DEMO_RECENT: LecturerOverviewRecentSubmission[] = [
  {
    id: "d1",
    assignment_id: "demo-assignment-1",
    student_name: "Alice Johnson",
    file_name: "trees.py",
    status: "released",
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    assignment_title: "Data Structures",
    score: 78,
    max_score: 100,
    workflowHref: "/dashboard/assignments/demo-assignment-1?source=queue&focus=released-results",
    workflowLabel: "Continue workflow",
  },
  {
    id: "d2",
    assignment_id: "demo-assignment-2",
    student_name: "Bob Smith",
    file_name: "essay.pdf",
    status: "ai_graded",
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    assignment_title: "Algorithms",
    score: 55,
    max_score: 100,
    workflowHref: "/dashboard/assignments/demo-assignment-2?source=notification&focus=ai-results",
    workflowLabel: "Review submission",
  },
  {
    id: "d3",
    assignment_id: "demo-assignment-3",
    student_name: "Carol White",
    file_name: "report.docx",
    status: "submitted",
    submitted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    assignment_title: "Database Design",
    score: null,
    max_score: 100,
    workflowHref: "/dashboard/assignments/demo-assignment-3?source=notification&focus=submission-review",
    workflowLabel: "Review submission",
  },
];

const EMPTY_PIPELINE: LecturerOverviewPipelineStage[] = [
  { label: "Submitted", count: 0, detail: "Waiting to enter marking." },
  { label: "AI Graded", count: 0, detail: "Ready for lecturer review." },
  { label: "Under Review", count: 0, detail: "Review, moderation, or approval in progress." },
  { label: "Released", count: 0, detail: "Visible to students." },
];

const DEMO_PIPELINE: LecturerOverviewPipelineStage[] = [
  { label: "Submitted", count: 0, detail: "Waiting to enter marking." },
  { label: "AI Graded", count: 1, detail: "Ready for lecturer review." },
  { label: "Under Review", count: 1, detail: "Review, moderation, or approval in progress." },
  { label: "Released", count: 1, detail: "Visible to students." },
];

const buildPipelineStages = (statuses: string[]): LecturerOverviewPipelineStage[] => [
  {
    label: "Submitted",
    count: statuses.filter((status) => ["submitted", "ai_grading"].includes(status)).length,
    detail: "Waiting to enter marking.",
  },
  {
    label: "AI Graded",
    count: statuses.filter((status) => status === "ai_graded").length,
    detail: "Ready for lecturer review.",
  },
  {
    label: "Under Review",
    count: statuses.filter((status) =>
      [
        "first_review",
        "moderation_pending",
        "moderation_in_progress",
        "moderated",
        "escalated",
        "under_review",
        "approved",
      ].includes(status),
    ).length,
    detail: "Review, moderation, or approval in progress.",
  },
  {
    label: "Released",
    count: statuses.filter((status) => status === "released").length,
    detail: "Visible to students.",
  },
];

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

const getOverviewSubmissionActionLabel = (status: string) => {
  if (["submitted", "ai_grading", "ai_graded", "first_review"].includes(status)) {
    return "Review submission";
  }

  if (["under_review", "moderation_pending", "moderation_in_progress", "escalated"].includes(status)) {
    return "Continue review";
  }

  return "Continue workflow";
};

const appendOverviewReturnContext = (href: string) =>
  href.includes("?") ? `${href}&from=overview` : `${href}?from=overview`;

export const formatStatusLabel = (status: string) => {
  switch (status) {
    case "submitted":
    case "ai_grading":
      return "Submitted";
    case "ai_graded":
    case "first_review":
    case "under_review":
      return "Lecturer Review";
    case "moderation_pending":
    case "moderation_in_progress":
    case "escalated":
      return "Moderation Required";
    case "moderated":
      return "Approved";
    case "approved":
      return "Ready to Release";
    case "released":
      return "Released";
    default:
      return status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

export const useLecturerOverviewController = () => {
  const { profile, user, isDemo } = useAuth();
  const [stats, setStats] = useState<LecturerOverviewStats>(isDemo ? DEMO_STATS : EMPTY_STATS);
  const [recent, setRecent] = useState<LecturerOverviewRecentSubmission[]>(isDemo ? DEMO_RECENT : []);
  const [pipeline, setPipeline] = useState<LecturerOverviewPipelineStage[]>(isDemo ? DEMO_PIPELINE : EMPTY_PIPELINE);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    if (!user) return;
    setError(null);

    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select(ASSIGNMENT_FIELDS)
        .eq("lecturer_id", user.id);

      if (assignmentsError) throw assignmentsError;

      const assignments = assignmentsData || [];
      const assignmentIds = assignments.map((assignment) => assignment.id);

      if (assignmentIds.length === 0) {
        setStats({ ...EMPTY_STATS, assignmentCount: 0 });
        setRecent([]);
        setPipeline(EMPTY_PIPELINE);
        setLoading(false);
        return;
      }

      const { data: submissionsData, error: submissionsError } = await supabase
        .from("submissions")
        .select(SUBMISSION_FIELDS)
        .in("assignment_id", assignmentIds);

      if (submissionsError) throw submissionsError;

      const allSubs = (submissionsData || []).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );

      const submissionIds = allSubs.map((submission) => submission.id);
      let allGrades: Array<{ submission_id: string; final_score: number | null; ai_score: number | null }> = [];

      if (submissionIds.length > 0) {
        const { data: gradesData, error: gradesError } = await supabase
          .from("grades")
          .select(GRADE_FIELDS)
          .in("submission_id", submissionIds);

        if (gradesError) throw gradesError;
        allGrades = gradesData || [];
      }

      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      assignments.forEach((assignment) => {
        assignmentMap[assignment.id] = { title: assignment.title, max_score: assignment.max_score };
      });

      const gradeMap: Record<string, { final_score: number | null; ai_score: number | null }> = {};
      allGrades.forEach((grade) => {
        gradeMap[grade.submission_id] = {
          final_score: grade.final_score,
          ai_score: grade.ai_score,
        };
      });

      const gradedSubs = allSubs.filter((submission) => isGradedWorkflowStatus(submission.status));
      const pendingSubs = allSubs.filter((submission) => isReviewQueueStatus(submission.status));
      const scoredEntries = allSubs
        .map((submission) => {
          const grade = gradeMap[submission.id];
          const score = grade?.final_score ?? grade?.ai_score;
          const maxScore = assignmentMap[submission.assignment_id]?.max_score ?? null;

          if (score == null || maxScore == null || maxScore <= 0) {
            return null;
          }

          return {
            score,
            maxScore,
          };
        })
        .filter((entry): entry is { score: number; maxScore: number } => entry != null);

      const { avgScore, avgScoreScale } =
        scoredEntries.length > 0
          ? (() => {
              const uniqueScales = new Set(scoredEntries.map((entry) => entry.maxScore));
              if (uniqueScales.size === 1) {
                return {
                  avgScore:
                    Math.round(
                      (scoredEntries.reduce((total, entry) => total + entry.score, 0) / scoredEntries.length) * 10,
                    ) / 10,
                  avgScoreScale: scoredEntries[0].maxScore,
                };
              }

              return {
                avgScore:
                  Math.round(
                    (scoredEntries.reduce((total, entry) => total + (entry.score / entry.maxScore) * 100, 0) /
                      scoredEntries.length) *
                      10,
                  ) / 10,
                avgScoreScale: 100,
              };
            })()
          : { avgScore: null, avgScoreScale: null };

      const studentScores: Record<string, number[]> = {};
      allSubs.forEach((submission) => {
        const key = submission.student_id || submission.student_name || submission.student_email;
        if (!key) return;

        const grade = gradeMap[submission.id];
        const score = grade?.final_score ?? grade?.ai_score;
        if (score != null) {
          if (!studentScores[key]) {
            studentScores[key] = [];
          }
          studentScores[key].push(score);
        }
      });

      let onTarget = 0;
      let atRisk = 0;
      Object.values(studentScores).forEach((studentScoreList) => {
        const studentAverage =
          studentScoreList.reduce((total, score) => total + score, 0) / studentScoreList.length;
        if (studentAverage >= 50) onTarget++;
        else atRisk++;
      });

      const uniqueStudents = new Set(
        allSubs.map((submission) => submission.student_id || submission.student_name || submission.student_email).filter(Boolean),
      );

      setStats({
        totalSubmissions: allSubs.length,
        gradedCount: gradedSubs.length,
        pendingCount: pendingSubs.length,
        avgScore,
        avgScoreScale,
        activeStudents: uniqueStudents.size,
        assignmentCount: assignments.length,
        onTarget,
        atRisk,
      });

      setPipeline(buildPipelineStages(allSubs.map((submission) => submission.status)));

      const recentSubs: LecturerOverviewRecentSubmission[] = allSubs.slice(0, 6).map((submission) => {
        const assignment = assignmentMap[submission.assignment_id];
        const grade = gradeMap[submission.id];
        const workflowTarget = getAssignmentWorkflowTarget({
          assignmentId: submission.assignment_id,
          status: submission.status,
        });

        return {
          id: submission.id,
          assignment_id: submission.assignment_id,
          student_name: submission.student_name || submission.student_email || "Student",
          file_name: submission.file_name,
          status: submission.status,
          submitted_at: submission.submitted_at,
          assignment_title: assignment?.title || "Unknown",
          score: grade?.final_score ?? grade?.ai_score ?? null,
          max_score: assignment?.max_score || 100,
          workflowHref: appendOverviewReturnContext(workflowTarget.href),
          workflowLabel: getOverviewSubmissionActionLabel(submission.status),
        };
      });
      setRecent(recentSubs);
    } catch (error) {
      log.error("Lecturer overview fetch failed", error, {
        userId: user.id,
      });
      setError("The lecturer overview could not be loaded right now.");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isDemo) return;
    void fetchDashboard();
  }, [isDemo]);
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
      stats,
      recent,
      pipeline,
      readiness,
      heroSummary,
      primaryWorkflowTarget,
      queueFocus,
    } satisfies LecturerOverviewState,
    actions: {
      reload: () => void fetchDashboard(),
    },
  };
};
