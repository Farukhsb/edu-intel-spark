import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCohortAnalyticsDataset } from "@/lib/data/cohort";
import { computeRisk, type AtRiskStudent, type StudentTrajectory } from "@/lib/studentRisk";
import {
  buildCohortRecommendations,
  getCohortReportingReadiness,
  type CohortRecommendation,
} from "@/lib/cohortRecommendations";
import {
  fetchPersistedRecommendations,
  mergePersistedRecommendationState,
  persistRecommendationAction,
  upsertGeneratedRecommendations,
} from "@/lib/recommendationPersistence";
import { buildRecommendationInterventionRows, insertRecommendationInterventions } from "@/lib/interventions";
import { parseStoredReviewPayload } from "@/lib/integrityReviews";
import { log } from "@/lib/logger";
import { buildAbsoluteAppUrl, copyTextToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import { DEMO_ASSIGNMENTS, DEMO_RECOMMENDATIONS, EMPTY_GRADE_DIST } from "./demoData";
import type {
  AssignmentAnalytics,
  BadgeVariant,
  CriterionBreakdownItem,
  GradeBand,
  StudentDirectoryEntry,
} from "./types";

const buildGradeDistribution = (scores: number[]): GradeBand[] => [
  { band: "1st (70+)", count: scores.filter((score) => score >= 70).length, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69)", count: scores.filter((score) => score >= 60 && score < 70).length, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59)", count: scores.filter((score) => score >= 50 && score < 60).length, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49)", count: scores.filter((score) => score >= 40 && score < 50).length, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40)", count: scores.filter((score) => score < 40).length, fill: "hsl(0, 72%, 55%)" },
];

export const severityVariant = (severity: CohortRecommendation["severity"]): BadgeVariant => {
  if (severity === "critical") return "destructive";
  if (severity === "high") return "secondary";
  if (severity === "medium") return "outline";
  return "default";
};

export const statusVariant = (status: CohortRecommendation["status"]): BadgeVariant => {
  if (status === "dismissed") return "outline";
  if (status === "actioned") return "default";
  if (status === "reviewed") return "secondary";
  return "outline";
};

export const formatStatusLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export interface RecommendationActionSummary {
  headline: string;
  detail: string;
  primaryLabel: string;
}

export const getRecommendationActionSummary = (
  recommendation: CohortRecommendation,
): RecommendationActionSummary => {
  const affectedStudentCount = recommendation.evidence.affectedStudentIds?.length ?? 0;
  const namedStudents = recommendation.evidence.affectedStudentNames?.length ?? 0;

  if (recommendation.type === "student risk") {
    if (recommendation.status === "actioned") {
      return {
        headline: "Intervention loop is live",
        detail:
          affectedStudentCount > 0
            ? `Intervention records were created for ${affectedStudentCount} student${affectedStudentCount === 1 ? "" : "s"}. Open the performance queue and confirm each follow-up is scheduled, contacted, or resolved.`
            : "This risk recommendation has been actioned. Open the performance queue and confirm the next student-support step is scheduled.",
        primaryLabel: "Open follow-up queue",
      };
    }

    return {
      headline: "Intervention candidates ready",
      detail:
        namedStudents > 0
          ? `${namedStudents} named student${namedStudents === 1 ? "" : "s"} can be moved straight into the intervention loop from this recommendation.`
          : "This recommendation is ready to create intervention records for the highest-risk students in the cohort.",
      primaryLabel: "Create intervention loop",
    };
  }

  if (recommendation.type === "integrity alerts") {
    return {
      headline: recommendation.status === "actioned" ? "Integrity follow-up opened" : "Integrity review required",
      detail:
        recommendation.status === "actioned"
          ? "Continue in the integrity queue and record whether each flagged submission is cleared, investigated, or escalated."
          : "Open the integrity queue, inspect the flagged submissions, and decide whether to investigate or clear them.",
      primaryLabel: recommendation.status === "actioned" ? "Open integrity queue" : "Open integrity review",
    };
  }

  if (recommendation.assignmentId) {
    return {
      headline: recommendation.status === "actioned" ? "Assignment remediation in progress" : "Assignment review required",
      detail:
        recommendation.status === "actioned"
          ? "Return to the assignment workflow and confirm that the weak grading pattern has been reviewed and the next lecturer action is tracked."
          : "Open the assignment workflow, inspect the weak pattern, and decide whether to regrade, moderate, or release support guidance first.",
      primaryLabel: recommendation.status === "actioned" ? "Open assignment workflow" : "Review assignment workflow",
    };
  }

  return {
    headline: "Recommendation follow-up",
    detail: "Open the linked workflow and record the next operational action instead of leaving this recommendation as a passive alert.",
    primaryLabel: recommendation.status === "actioned" ? "Continue follow-up" : "Open workflow",
  };
};

export const getRecommendationRoute = (recommendation: CohortRecommendation) => {
  if (recommendation.type === "student risk") return "/dashboard/performance?risk=high-plus";
  if (recommendation.type === "integrity alerts") return "/dashboard/integrity";
  if (recommendation.assignmentId) return `/dashboard/assignments/${recommendation.assignmentId}`;
  return "/dashboard/assignments";
};

const normalizeCriterionBreakdown = (value: unknown): CriterionBreakdownItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      criterion: typeof item.criterion === "string" ? item.criterion : "Criterion",
      score: typeof item.score === "number" ? item.score : 0,
      max_score: typeof item.max_score === "number" ? item.max_score : 0,
    }))
    .filter((item) => item.max_score > 0);
};

export const useCohortAnalyticsController = () => {
  const { isDemo, user } = useAuth();
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [modules, setModules] = useState<AssignmentAnalytics[]>(isDemo ? DEMO_ASSIGNMENTS : []);
  const [allScores, setAllScores] = useState<Array<{ assignmentId: string; score: number }>>([]);
  const [recommendations, setRecommendations] = useState<CohortRecommendation[]>(
    isDemo ? DEMO_RECOMMENDATIONS : [],
  );
  const [studentDirectory, setStudentDirectory] = useState<Record<string, StudentDirectoryEntry>>({});
  const [loading, setLoading] = useState(!isDemo);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo || !user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ assignments, submissions, grades, integrityReviews }, persistedRows] = await Promise.all([
          fetchCohortAnalyticsDataset(user.id),
          fetchPersistedRecommendations(user.id),
        ]);

        if (assignments.length === 0) {
          setModules([]);
          setRecommendations([]);
          setAllScores([]);
          setStudentDirectory({});
          setLoading(false);
          return;
        }

        const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
        const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
        const scoresBySubmission = new Map<string, number>();
        const scoresByAssignment = new Map<string, number[]>();
        const criterionMap = new Map<string, import("./types").CriterionAnalytics>();
        const directory: Record<string, StudentDirectoryEntry> = {};

        for (const grade of grades) {
          const score = grade.final_score ?? grade.ai_score;
          if (score == null) continue;

          scoresBySubmission.set(grade.submission_id, score);

          const submission = submissionById.get(grade.submission_id);
          if (!submission) continue;
          const assignment = assignmentById.get(submission.assignment_id);
          if (!assignment) continue;

          const assignmentScores = scoresByAssignment.get(submission.assignment_id) || [];
          assignmentScores.push(score);
          scoresByAssignment.set(submission.assignment_id, assignmentScores);

          const studentId =
            submission.student_id || submission.student_email || `${submission.student_name || "student"}:${submission.id}`;
          directory[studentId] = {
            studentId,
            name: submission.student_name || submission.student_email || "Student",
            email: submission.student_email || null,
          };

          for (const item of normalizeCriterionBreakdown(grade.ai_breakdown)) {
            const criterionKey = `${submission.assignment_id}:${item.criterion.toLowerCase()}`;
            const current = criterionMap.get(criterionKey) || {
              key: criterionKey,
              criterion: item.criterion,
              avgScore: 0,
              averagePercent: 0,
              submissionCount: 0,
              assignmentId: submission.assignment_id,
              assignmentTitle: assignment.title,
            };
            const totalScore = current.avgScore * current.submissionCount + item.score;
            const totalPercent =
              current.averagePercent * current.submissionCount + (item.score / Math.max(item.max_score, 1)) * 100;
            current.submissionCount += 1;
            current.avgScore = totalScore / current.submissionCount;
            current.averagePercent = totalPercent / current.submissionCount;
            criterionMap.set(criterionKey, current);
          }
        }

        const moduleData: AssignmentAnalytics[] = assignments.map((assignment) => {
          const assignmentSubmissions = submissions.filter((submission) => submission.assignment_id === assignment.id);
          const scores = scoresByAssignment.get(assignment.id) || [];
          const avgScore = scores.length > 0 ? scores.reduce((total, value) => total + value, 0) / scores.length : 0;
          const failRate =
            scores.length > 0 ? (scores.filter((score) => score < 40).length / scores.length) * 100 : 0;

          return {
            id: assignment.id,
            title: assignment.title,
            moduleCode: assignment.module_code,
            avgScore: Math.round(avgScore),
            failRate: Math.round(failRate),
            passRate: Math.round(100 - failRate),
            gradedCount: scores.length,
            submissions: assignmentSubmissions.length,
            createdAt: assignment.created_at,
          };
        });

        const allScoresData = Array.from(scoresBySubmission.entries()).map(([submissionId, score]) => ({
          assignmentId: submissionById.get(submissionId)?.assignment_id || "",
          score,
        }));

        const trajectories = new Map<string, StudentTrajectory>();
        for (const submission of submissions) {
          const score = scoresBySubmission.get(submission.id);
          if (score == null) continue;
          const studentId =
            submission.student_id || submission.student_email || `${submission.student_name || "student"}:${submission.id}`;
          const existing = trajectories.get(studentId) || {
            studentId,
            name: submission.student_name || submission.student_email || "Student",
            email: submission.student_email || null,
            scores: [],
          };
          existing.scores.push({
            score,
            date: submission.submitted_at,
            assignmentTitle: assignmentById.get(submission.assignment_id)?.title || "Assignment",
          });
          trajectories.set(studentId, existing);
        }

        const atRiskStudents = Array.from(trajectories.values())
          .map((trajectory) => ({
            ...trajectory,
            scores: [...trajectory.scores].sort(
              (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
            ),
          }))
          .map((trajectory) => computeRisk(trajectory))
          .filter((student): student is AtRiskStudent => student !== null)
          .sort((left, right) => right.riskScore - left.riskScore);

        const highRiskStudents = atRiskStudents.filter(
          (student) => student.riskLevel === "critical" || student.riskLevel === "high",
        );

        const flaggedIntegrityCaseIds = new Set<string>();
        const flaggedIntegrityCases = integrityReviews.filter((review) => {
          const payload = parseStoredReviewPayload(review);
          const totalScore = payload.integritySnapshot?.totalScore || 0;
          const flagged =
            totalScore >= 55 || review.decision === "investigate" || review.decision === "misconduct-concern";
          if (flagged) flaggedIntegrityCaseIds.add(review.submission_id);
          return flagged;
        });

        const cohortScores = allScoresData.map((item) => item.score);
        const cohortAverage =
          cohortScores.length > 0 ? cohortScores.reduce((total, score) => total + score, 0) / cohortScores.length : 0;
        const failRate =
          cohortScores.length > 0
            ? (cohortScores.filter((score) => score < 40).length / cohortScores.length) * 100
            : 0;

        const snapshot = {
          lecturerId: user.id,
          cohortAverage,
          failRate,
          gradedCount: cohortScores.length,
          assignments: moduleData,
          criteria: Array.from(criterionMap.values()).sort((left, right) => left.averagePercent - right.averagePercent),
          atRiskStudents,
          highRiskStudents,
          integrityFlaggedCount: flaggedIntegrityCases.length,
          integritySubmissionCount: submissions.length,
          integrityFlaggedSubmissionIds: flaggedIntegrityCases.map((review) => review.submission_id),
          integrityByAssignment: moduleData
            .map((assignment) => {
              const assignmentSubmissions = submissions.filter((submission) => submission.assignment_id === assignment.id);
              const flaggedSubmissionIds = assignmentSubmissions
                .filter((submission) => flaggedIntegrityCaseIds.has(submission.id))
                .map((submission) => submission.id);

              return {
                assignmentId: assignment.id,
                assignmentTitle: assignment.title,
                flaggedCount: flaggedSubmissionIds.length,
                submissionCount: assignmentSubmissions.length,
                flaggedSubmissionIds,
              };
            })
            .filter((assignment) => assignment.submissionCount > 0),
        };

        const generatedRecommendations = buildCohortRecommendations(snapshot);
        await upsertGeneratedRecommendations(user.id, generatedRecommendations, persistedRows);
        const mergedRecommendations = mergePersistedRecommendationState(generatedRecommendations, persistedRows);

        setModules(moduleData);
        setAllScores(allScoresData);
        setRecommendations(mergedRecommendations);
        setStudentDirectory(directory);
      } catch (error) {
        log.error("Failed to fetch cohort analytics", error);
        toast.error("Could not load cohort analytics.");
      }

      setLoading(false);
    };

    void fetchData();
  }, [isDemo, user]);

  const gradeDistChart = useMemo(() => {
    if (isDemo) {
      return buildGradeDistribution(
        moduleFilter === "all" ? [72, 69, 65, 61, 58, 54, 49, 43, 35] : [66, 61, 58, 49, 45, 39, 32],
      );
    }

    const relevantScores =
      moduleFilter === "all"
        ? allScores.map((item) => item.score)
        : allScores.filter((item) => item.assignmentId === moduleFilter).map((item) => item.score);
    return relevantScores.length > 0 ? buildGradeDistribution(relevantScores) : EMPTY_GRADE_DIST;
  }, [allScores, isDemo, moduleFilter]);

  const filteredModules = useMemo(
    () => (moduleFilter === "all" ? modules : modules.filter((module) => module.id === moduleFilter)),
    [moduleFilter, modules],
  );

  const visibleRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) =>
          recommendation.status !== "dismissed" &&
          (moduleFilter === "all" || !recommendation.assignmentId || recommendation.assignmentId === moduleFilter),
      ),
    [moduleFilter, recommendations],
  );

  const reportingReadiness = useMemo(
    () =>
      getCohortReportingReadiness({
        assignments: filteredModules,
        recommendations: visibleRecommendations,
      }),
    [filteredModules, visibleRecommendations],
  );

  const updateRecommendationStatus = (
    recommendation: CohortRecommendation,
    nextStatus: CohortRecommendation["status"],
  ) => {
    setRecommendations((current) =>
      current.map((item) => (item.id === recommendation.id ? { ...item, status: nextStatus } : item)),
    );
  };

  const handleReview = async (recommendation: CohortRecommendation) => {
    setActingId(recommendation.id);
    if (!isDemo && user) {
      try {
        await persistRecommendationAction({
          lecturerId: user.id,
          recommendation,
          actionType: "review",
          nextStatus: "reviewed",
        });
      } catch (error) {
        log.error("Failed to persist review action", error, {
          recommendationId: recommendation.id,
        });
        toast.error("Could not save recommendation review.");
        setActingId(null);
        return;
      }
    }
    updateRecommendationStatus(recommendation, "reviewed");
    setActingId(null);
    navigate(getRecommendationRoute(recommendation));
  };

  const handleDismiss = async (recommendation: CohortRecommendation) => {
    setActingId(recommendation.id);
    if (!isDemo && user) {
      try {
        await persistRecommendationAction({
          lecturerId: user.id,
          recommendation,
          actionType: "dismiss",
          nextStatus: "dismissed",
        });
      } catch (error) {
        log.error("Failed to persist dismiss action", error, {
          recommendationId: recommendation.id,
        });
        toast.error("Could not dismiss recommendation.");
        setActingId(null);
        return;
      }
    }
    updateRecommendationStatus(recommendation, "dismissed");
    setActingId(null);
  };

  const handleCreateIntervention = async (recommendation: CohortRecommendation) => {
    setActingId(recommendation.id);
    const targetIds = recommendation.evidence.affectedStudentIds || [];

    if (!user) {
      setActingId(null);
      return;
    }

    if (recommendation.status === "actioned") {
      setActingId(null);
      navigate(getRecommendationRoute(recommendation));
      return;
    }

    if (targetIds.length > 0 && !isDemo) {
      const interventionTargets = targetIds
        .slice(0, 5)
        .map((studentId) => studentDirectory[studentId])
        .filter((entry): entry is StudentDirectoryEntry => Boolean(entry))
        .map((entry) => ({
          studentId: entry.studentId,
          name: entry.name,
          email: entry.email,
        }));

      const interventionRows = buildRecommendationInterventionRows({
        lecturerId: user.id,
        title: recommendation.title,
        summary: recommendation.summary,
        recommendedActions: recommendation.recommendedActions,
        severity: recommendation.severity,
        assignmentId: recommendation.assignmentId ?? null,
        targets: interventionTargets,
      });

      if (interventionRows.length > 0) {
        const { error } = await insertRecommendationInterventions(supabase, interventionRows);
        if (error) {
          log.error("Failed to create intervention rows", error, {
            targetCount: interventionTargets.length,
          });
          toast.error("Could not create interventions.");
          setActingId(null);
          return;
        }
      }
    }

    if (!isDemo) {
      try {
        await persistRecommendationAction({
          lecturerId: user.id,
          recommendation,
          actionType: "create_intervention",
          nextStatus: "actioned",
        });
      } catch (error) {
        log.error("Failed to persist intervention action", error, {
          recommendationId: recommendation.id,
        });
        toast.error("Intervention was created, but recommendation status could not be updated.");
        setActingId(null);
        return;
      }
    }

    updateRecommendationStatus(recommendation, "actioned");
    setActingId(null);

    if (targetIds.length > 0) {
      toast.success("Intervention actions created for the affected students.");
      navigate("/dashboard/performance?risk=high-plus");
      return;
    }

    toast.success("Recommendation marked for intervention planning.");
    navigate(getRecommendationRoute(recommendation));
  };

  const handleCopyWorkflowLink = async (recommendation: CohortRecommendation) => {
    const copied = await copyTextToClipboard(
      buildAbsoluteAppUrl(getRecommendationRoute(recommendation)),
    );
    if (copied) {
      toast.success("Workflow link copied.");
      return;
    }

    toast.error("Could not copy the workflow link.");
  };

  return {
    loading,
    modules,
    moduleFilter,
    setModuleFilter,
    gradeDistChart,
    filteredModules,
    visibleRecommendations,
    reportingReadiness,
    actingId,
    handleReview,
    handleDismiss,
    handleCreateIntervention,
    handleCopyWorkflowLink,
  };
};
