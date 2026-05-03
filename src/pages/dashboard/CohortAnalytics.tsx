import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Shield,
  TrendingDown,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { computeRisk, type AtRiskStudent, type StudentTrajectory } from "@/lib/studentRisk";
import {
  buildCohortRecommendations,
  getCohortReportingReadiness,
  type AssignmentAnalytics,
  type CohortAnalyticsSnapshot,
  type CohortRecommendation,
  type CriterionAnalytics,
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
import { toast } from "sonner";
import {
  DashboardEmptyState,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";

const ASSIGNMENT_FIELDS = "id, title, module_code, created_at, max_score";
const SUBMISSION_FIELDS =
  "id, assignment_id, student_id, student_name, student_email, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score, ai_breakdown";

type AssignmentRow = Pick<Tables<"assignments">, "id" | "title" | "module_code" | "created_at" | "max_score">;
type SubmissionRow = Pick<
  Tables<"submissions">,
  "id" | "assignment_id" | "student_id" | "student_name" | "student_email" | "status" | "submitted_at"
>;
type GradeRow = Pick<Tables<"grades">, "submission_id" | "ai_score" | "final_score" | "ai_breakdown">;
type IntegrityReviewRow = Pick<
  Tables<"academic_integrity_reviews">,
  "submission_id" | "decision" | "lecturer_note" | "updated_at"
>;

interface GradeBand {
  band: string;
  count: number;
  fill: string;
}

interface CriterionBreakdownItem {
  criterion: string;
  score: number;
  max_score: number;
}

interface StudentDirectoryEntry {
  studentId: string;
  name: string;
  email: string | null;
}

interface LoadedAnalytics {
  assignments: AssignmentAnalytics[];
  snapshot: CohortAnalyticsSnapshot;
  allScores: Array<{ assignmentId: string; score: number }>;
  studentDirectory: Record<string, StudentDirectoryEntry>;
}

const EMPTY_GRADE_DIST: GradeBand[] = [
  { band: "1st (70+)", count: 0, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69)", count: 0, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59)", count: 0, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49)", count: 0, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40)", count: 0, fill: "hsl(0, 72%, 55%)" },
];

const DEMO_ASSIGNMENTS: AssignmentAnalytics[] = [
  {
    id: "demo-a1",
    title: "Algorithms Coursework",
    moduleCode: "CS205",
    avgScore: 63,
    failRate: 18,
    passRate: 82,
    gradedCount: 28,
    submissions: 30,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  {
    id: "demo-a2",
    title: "Dynamic Programming Test",
    moduleCode: "CS205",
    avgScore: 49,
    failRate: 37,
    passRate: 63,
    gradedCount: 30,
    submissions: 30,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

const DEMO_RECOMMENDATIONS: CohortRecommendation[] = [
  {
    id: "demo:low_cohort_average",
    type: "performance",
    ruleCode: "low_cohort_average",
    title: "Low cohort average detected",
    summary: "The current cohort average is 44%, below the 45% threshold.",
    explanation: "Students are struggling across the cohort, not just in a narrow subgroup.",
    severity: "high",
    confidence: 0.96,
    recommendedActions: [
      "Review the weakest assignment and rubric areas.",
      "Run a short recap session before the next deadline.",
    ],
    evidence: {
      metrics: [
        { label: "Cohort average", value: "44%" },
        { label: "Graded submissions", value: "30" },
      ],
      assignmentId: "demo-a2",
      assignmentTitle: "Dynamic Programming Test",
    },
    status: "open",
    createdAt: new Date().toISOString(),
    assignmentId: "demo-a2",
  },
  {
    id: "demo:student_risk_cluster",
    type: "student risk",
    ruleCode: "high_risk_student_cluster",
    title: "High-risk student cluster detected",
    summary: "8 students are in the high or critical risk band.",
    explanation: "The existing trajectory-based risk engine is flagging a meaningful cluster size.",
    severity: "critical",
    confidence: 0.94,
    recommendedActions: [
      "Open the risk workflow and prioritise the highest-risk students.",
      "Create targeted check-ins for the affected students.",
    ],
    evidence: {
      metrics: [
        { label: "High-risk students", value: "8" },
        { label: "Risk share of flagged cohort", value: "22%" },
      ],
      affectedStudentIds: ["demo-student-1", "demo-student-2"],
      affectedStudentNames: ["Ada Lovelace", "Alan Turing"],
    },
    status: "open",
    createdAt: new Date().toISOString(),
  },
];

const buildGradeDistribution = (scores: number[]): GradeBand[] => [
  { band: "1st (70+)", count: scores.filter((score) => score >= 70).length, fill: "hsl(152, 56%, 45%)" },
  { band: "2:1 (60-69)", count: scores.filter((score) => score >= 60 && score < 70).length, fill: "hsl(205, 80%, 55%)" },
  { band: "2:2 (50-59)", count: scores.filter((score) => score >= 50 && score < 60).length, fill: "hsl(38, 92%, 60%)" },
  { band: "3rd (40-49)", count: scores.filter((score) => score >= 40 && score < 50).length, fill: "hsl(280, 55%, 55%)" },
  { band: "Fail (<40)", count: scores.filter((score) => score < 40).length, fill: "hsl(0, 72%, 55%)" },
];

const severityVariant = (severity: CohortRecommendation["severity"]) => {
  if (severity === "critical") return "destructive";
  if (severity === "high") return "secondary";
  if (severity === "medium") return "outline";
  return "default";
};

const statusVariant = (status: CohortRecommendation["status"]) => {
  if (status === "dismissed") return "outline";
  if (status === "actioned") return "default";
  if (status === "reviewed") return "secondary";
  return "outline";
};

const formatStatusLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const getRecommendationRoute = (recommendation: CohortRecommendation) => {
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

const CohortAnalytics = () => {
  const { isDemo, user } = useAuth();
  const navigate = useNavigate();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [modules, setModules] = useState<AssignmentAnalytics[]>(isDemo ? DEMO_ASSIGNMENTS : []);
  const [allScores, setAllScores] = useState<Array<{ assignmentId: string; score: number }>>([]);
  const [recommendations, setRecommendations] = useState<CohortRecommendation[]>(
    isDemo ? DEMO_RECOMMENDATIONS : []
  );
  const [studentDirectory, setStudentDirectory] = useState<Record<string, StudentDirectoryEntry>>({});
  const [loading, setLoading] = useState(!isDemo);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo || !user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select(ASSIGNMENT_FIELDS)
          .eq("lecturer_id", user.id)
          .order("created_at", { ascending: true });

        if (assignmentsError) throw assignmentsError;

        const assignments = (assignmentsData || []) as AssignmentRow[];
        const assignmentIds = assignments.map((assignment) => assignment.id);

        if (assignmentIds.length === 0) {
          setModules([]);
          setRecommendations([]);
          setAllScores([]);
          setStudentDirectory({});
          setLoading(false);
          return;
        }

        const [{ data: submissionsData, error: submissionsError }, persistedRows] = await Promise.all([
          supabase.from("submissions").select(SUBMISSION_FIELDS).in("assignment_id", assignmentIds),
          fetchPersistedRecommendations(user.id),
        ]);

        if (submissionsError) throw submissionsError;

        const submissions = (submissionsData || []) as SubmissionRow[];
        const submissionIds = submissions.map((submission) => submission.id);

        const [gradesRes, integrityRes] = await Promise.all([
          submissionIds.length > 0
            ? supabase.from("grades").select(GRADE_FIELDS).in("submission_id", submissionIds)
            : Promise.resolve({ data: [], error: null }),
          submissionIds.length > 0
            ? supabase
                .from("academic_integrity_reviews")
                .select("submission_id, decision, lecturer_note, updated_at")
                .eq("lecturer_id", user.id)
                .in("submission_id", submissionIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (gradesRes.error) throw gradesRes.error;
        if (integrityRes.error) throw integrityRes.error;

        const grades = (gradesRes.data || []) as GradeRow[];
        const integrityReviews = (integrityRes.data || []) as IntegrityReviewRow[];

        const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
        const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
        const scoresBySubmission = new Map<string, number>();
        const scoresByAssignment = new Map<string, number[]>();
        const criterionMap = new Map<string, CriterionAnalytics>();
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
          const avgScore =
            scores.length > 0
              ? scores.reduce((total, value) => total + value, 0) / scores.length
              : 0;
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
              (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
            ),
          }))
          .map((trajectory) => computeRisk(trajectory))
          .filter((student): student is AtRiskStudent => student !== null)
          .sort((left, right) => right.riskScore - left.riskScore);

        const highRiskStudents = atRiskStudents.filter(
          (student) => student.riskLevel === "critical" || student.riskLevel === "high"
        );

        const flaggedIntegrityCaseIds = new Set<string>();
        const flaggedIntegrityCases = integrityReviews.filter((review) => {
          const payload = parseStoredReviewPayload(review);
          const totalScore = payload.integritySnapshot?.totalScore || 0;
          const flagged =
            totalScore >= 55 || review.decision === "investigate" || review.decision === "misconduct-concern";
          if (flagged) {
            flaggedIntegrityCaseIds.add(review.submission_id);
          }
          return flagged;
        });

        const cohortScores = allScoresData.map((item) => item.score);
        const cohortAverage =
          cohortScores.length > 0
            ? cohortScores.reduce((total, score) => total + score, 0) / cohortScores.length
            : 0;
        const failRate =
          cohortScores.length > 0
            ? (cohortScores.filter((score) => score < 40).length / cohortScores.length) * 100
            : 0;

        const snapshot: CohortAnalyticsSnapshot = {
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
  }, [isDemo, user?.id]);

  const gradeDistChart = useMemo(() => {
    if (isDemo) {
      return buildGradeDistribution(
        moduleFilter === "all"
          ? [72, 69, 65, 61, 58, 54, 49, 43, 35]
          : [66, 61, 58, 49, 45, 39, 32]
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
    [moduleFilter, modules]
  );

  const visibleRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) =>
          recommendation.status !== "dismissed" &&
          (moduleFilter === "all" || !recommendation.assignmentId || recommendation.assignmentId === moduleFilter)
      ),
    [moduleFilter, recommendations]
  );

  const reportingReadiness = useMemo(
    () =>
      getCohortReportingReadiness({
        assignments: filteredModules,
        recommendations: visibleRecommendations,
      }),
    [filteredModules, visibleRecommendations]
  );

  const updateRecommendationStatus = (
    recommendation: CohortRecommendation,
    nextStatus: CohortRecommendation["status"]
  ) => {
    setRecommendations((current) =>
      current.map((item) => (item.id === recommendation.id ? { ...item, status: nextStatus } : item))
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
          studentId,
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
          studentId,
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
            targetCount: selectedStudentIds.length,
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
        log.error("Failed to persist intervention action", error);
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

  if (loading) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Reporting Readiness</CardTitle>
          <CardDescription>
            A compact reading of which cohort-level signal is most likely to need intervention or explanation next.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current posture</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on the current recommendation severity mix and weakest assignment performance in this cohort view.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the cohort signal most likely to require either direct action or a clear quality-review explanation.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide whether to move into student-risk follow-up, integrity review, or assignment remediation first.
            </p>
          </div>
        </CardContent>
      </Card>

      {modules.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filter by assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.moduleCode ? `${module.moduleCode} - ` : ""}
                  {module.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="distribution">
        <TabsList>
          <TabsTrigger value="distribution">Grade Distribution</TabsTrigger>
          <TabsTrigger value="modules">Assignment Comparison</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grade Distribution</CardTitle>
              <CardDescription>
                {moduleFilter === "all" ? "Cohort classification breakdown" : "Distribution for the selected assignment"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistChart.every((item) => item.count === 0) ? (
                <DashboardEmptyState
                  title="No graded submissions yet"
                  description="Grade distribution will appear after assignments are graded."
                />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={gradeDistChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {gradeDistChart.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          {filteredModules.length === 0 ? (
            <DashboardEmptyState
              title="No assignments found"
              description="Assignment comparison appears after assignments and grading data are available."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredModules.map((module) => (
                <Card key={module.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">
                          {module.moduleCode ? `${module.moduleCode} - ` : ""}
                          {module.title}
                        </p>
                        <p className="mt-1 text-3xl font-bold font-display">
                          {module.gradedCount > 0 ? `${module.avgScore}%` : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">Average Grade</p>
                      </div>
                      {module.submissions > 0 && (
                        <Badge
                          variant={
                            module.passRate >= 80 ? "default" : module.passRate >= 70 ? "secondary" : "destructive"
                          }
                        >
                          {module.passRate}% pass
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>{module.submissions} submissions</span>
                      <span>{module.gradedCount} graded</span>
                      <span>{module.failRate}% fail rate</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4 space-y-4">
          {visibleRecommendations.length === 0 ? (
            <DashboardEmptyState
              title="No recommendations yet"
              description="Explainable recommendations will appear here once enough analytics data is available."
            />
          ) : (
            visibleRecommendations.map((recommendation) => (
              <Card key={recommendation.id} className="border-l-4 border-l-primary">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-sm">{recommendation.title}</h3>
                          <Badge variant={severityVariant(recommendation.severity) as any} className="text-xs">
                            {recommendation.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {recommendation.type}
                          </Badge>
                          <Badge variant={statusVariant(recommendation.status) as any} className="text-xs">
                            {formatStatusLabel(recommendation.status)}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
                        <p className="text-sm">{recommendation.explanation}</p>

                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {recommendation.evidence.metrics.map((metric) => (
                              <Badge key={`${recommendation.id}-${metric.label}`} variant="outline" className="text-xs">
                                {metric.label}: {metric.value}
                              </Badge>
                            ))}
                          </div>
                          {recommendation.evidence.affectedStudentNames &&
                            recommendation.evidence.affectedStudentNames.length > 0 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Affected students: {recommendation.evidence.affectedStudentNames.join(", ")}
                              </p>
                            )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Suggested Actions
                          </p>
                          {recommendation.recommendedActions.map((action) => (
                            <div key={`${recommendation.id}-${action}`} className="flex items-start gap-2 text-sm">
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <span>{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:w-[240px] lg:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === recommendation.id}
                        onClick={() => void handleReview(recommendation)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === recommendation.id}
                        onClick={() => void handleDismiss(recommendation)}
                      >
                        <Shield className="mr-1.5 h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingId === recommendation.id}
                        onClick={() => void handleCreateIntervention(recommendation)}
                      >
                        {recommendation.type === "student risk" ? (
                          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Create Intervention
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CohortAnalytics;
