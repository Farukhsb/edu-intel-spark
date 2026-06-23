import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { getAssignmentWorkflowTarget } from "@/lib/assignmentWorkflowNavigation";
import { isGradedWorkflowStatus, isReviewQueueStatus } from "@/lib/assessmentWorkflow";
import { safeToLocaleDate } from "@/lib/date";
import { getLecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";
import { type StudentTrajectory } from "@/lib/studentRisk";
import { mapRiskModelPredictionToAtRiskStudent, scoreStudentRisk } from "@/lib/riskModel";
import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";

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

const ASSIGNMENT_FIELDS = "id, title, max_score";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, file_name, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score, grade_source";
const GRADE_FIELDS_FALLBACK = "submission_id, ai_score, final_score";

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

const EMPTY_PIPELINE: LecturerOverviewPipelineStage[] = [
  { label: "Submitted", count: 0, detail: "Waiting to enter marking." },
  { label: "AI Graded", count: 0, detail: "Ready for lecturer review." },
  { label: "Under Review", count: 0, detail: "Review, moderation, or approval in progress." },
  { label: "Released", count: 0, detail: "Visible to students." },
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
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<LecturerOverviewStats>(EMPTY_STATS);
  const [recent, setRecent] = useState<LecturerOverviewRecentSubmission[]>([]);
  const [pipeline, setPipeline] = useState<LecturerOverviewPipelineStage[]>([]);
  const [topAtRiskStudents, setTopAtRiskStudents] = useState<LecturerOverviewAtRiskSummary[]>([]);
  const [assignments, setAssignments] = useState<LecturerOverviewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  let loadedAssignments: LecturerOverviewAssignment[] = [];

  const isGradeSourceSchemaError = (value: unknown) => {
    if (!(value instanceof Error)) return false;
    return /grade_source|column|schema/i.test(value.message);
  };

  const fetchDashboard = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setLoadWarning(null);

    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select(ASSIGNMENT_FIELDS)
        .eq("lecturer_id", user.id);

      if (assignmentsError) throw assignmentsError;

      loadedAssignments = assignmentsData || [];
      setAssignments(loadedAssignments);
      const assignmentIds = loadedAssignments.map((assignment) => assignment.id);

      if (assignmentIds.length === 0) {
        setStats({ ...EMPTY_STATS, assignmentCount: 0 });
        setRecent([]);
        setPipeline(EMPTY_PIPELINE);
        setTopAtRiskStudents([]);
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
      let allGrades: Array<{ submission_id: string; final_score: number | null; ai_score: number | null; grade_source: string | null }> = [];

      if (submissionIds.length > 0) {
        const gradeQuery = async (fields: string) => {
          try {
            const { data, error: gradesError } = await supabase
              .from("grades")
              .select(fields as never)
              .in("submission_id", submissionIds);

            return { data, gradesError: gradesError ?? null };
          } catch (gradesError) {
            return {
              data: null,
              gradesError,
            };
          }
        };

        const primaryGrades = await gradeQuery(GRADE_FIELDS);
        if (primaryGrades.gradesError) {
          log.warn("Lecturer overview grade source lookup failed; retrying without grade_source", {
            userId: user.id,
            error: primaryGrades.gradesError,
          });
          setLoadWarning("Some grade metadata is temporarily unavailable, but the teaching overview is still loading.");
          const fallbackGrades = await gradeQuery(GRADE_FIELDS_FALLBACK);
          if (fallbackGrades.gradesError) {
            log.warn("Lecturer overview grade fallback query failed", {
              userId: user.id,
              error: fallbackGrades.gradesError,
            });
            setLoadWarning("Some grade metadata is temporarily unavailable, but the teaching overview is still loading.");
            allGrades = [];
          } else {
            allGrades = (fallbackGrades.data as unknown as Array<{
              submission_id: string;
              final_score: number | null;
              ai_score: number | null;
              grade_source: string | null;
            }>) || [];
          }
        } else {
          allGrades = (primaryGrades.data as unknown as Array<{
            submission_id: string;
            final_score: number | null;
            ai_score: number | null;
            grade_source: string | null;
          }>) || [];
        }
      }

      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      loadedAssignments.forEach((assignment) => {
        assignmentMap[assignment.id] = { title: assignment.title, max_score: assignment.max_score };
      });

      const gradeMap: Record<string, { final_score: number | null; ai_score: number | null; grade_source: string | null }> = {};
      allGrades.forEach((grade) => {
        gradeMap[grade.submission_id] = {
          final_score: grade.final_score,
          ai_score: grade.ai_score,
          grade_source: grade.grade_source,
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
      const studentTrajectories = allSubs.reduce<Record<string, StudentTrajectory>>((accumulator, submission) => {
        const key = submission.student_id || submission.student_email || submission.id;
        const assignment = assignmentMap[submission.assignment_id];
        const grade = gradeMap[submission.id];
        const score = grade?.final_score ?? grade?.ai_score;

        if (!key || score == null) {
          return accumulator;
        }

        const trajectory =
          accumulator[key] ??
          {
            studentId: submission.student_id || key,
            name: submission.student_name || submission.student_email || "Student",
            email: submission.student_email || null,
            scores: [],
          };

        trajectory.scores.push({
          score,
          date: submission.submitted_at,
          assignmentTitle: assignment?.title || "Assignment",
        });

        accumulator[key] = trajectory;
        return accumulator;
      }, {});

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

      const riskSummaries = Object.values(studentTrajectories)
        .map((trajectory) => ({
          ...trajectory,
          scores: [...trajectory.scores].sort(
            (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
          ),
        }))
        .map((trajectory) => mapRiskModelPredictionToAtRiskStudent(trajectory, scoreStudentRisk(trajectory)))
        .filter((risk): risk is NonNullable<ReturnType<typeof mapRiskModelPredictionToAtRiskStudent>> => risk !== null)
        .sort((left, right) => right.riskScore - left.riskScore)
        .slice(0, 3)
        .map((risk) => ({
          studentId: risk.studentId,
          name: risk.name,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          signal: `${risk.riskLevel === "critical" ? "Critical" : risk.riskLevel === "high" ? "High" : "Moderate"} risk - ${
            risk.flags[0] ?? `predicted next outcome ${risk.predictedNext}%`
          }`,
        }));

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
      setTopAtRiskStudents(riskSummaries);

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
          grade_source: grade?.grade_source ?? null,
          workflowHref: appendOverviewReturnContext(workflowTarget.href),
          workflowLabel: getOverviewSubmissionActionLabel(submission.status),
        };
      });
      setRecent(recentSubs);
    } catch (error) {
      if (isGradeSourceSchemaError(error)) {
        log.warn("Lecturer overview grade_source lookup failed; showing partial overview", {
          userId: user.id,
          error,
        });
        setLoadWarning("Some grade metadata is temporarily unavailable, but the teaching overview is still loading.");
        setRecent([]);
        setPipeline(EMPTY_PIPELINE);
        setTopAtRiskStudents([]);
        setStats({ ...EMPTY_STATS, assignmentCount: loadedAssignments.length });
      } else {
        log.error("Lecturer overview fetch failed", error, {
          userId: user.id,
        });
        setError("The lecturer overview could not be loaded right now.");
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchDashboard();
  }, [user]);
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
      reload: () => void fetchDashboard(),
    },
  };
};
