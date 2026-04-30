import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Circle } from "lucide-react";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
  DashboardPageIntro,
} from "@/components/dashboard/PageStates";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/date";
import type { CommunicationMessage } from "@/lib/communications";
import { log } from "@/lib/logger";
import { safeParseExplanationResponse, safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ImprovementTask {
  id: string;
  task: string;
  area: string;
  done: boolean;
}

interface PlanModule {
  module: string;
  currentGrade: number;
  targetGrade: number;
  trend: "up" | "down" | "steady";
  trendDelta: number;
  strengths: string[];
  weaknesses: string[];
  nextSubmissionFocus: string[];
  tasks: ImprovementTask[];
  chart: Array<{ assessment: string; score: number }>;
  weakCriteria: Array<{
    criterion: string;
    average: number;
    attempts: number;
    feedback?: string;
  }>;
}

interface Resource {
  priority: number;
  heading: string;
  duration: string;
  estimatedLift: string;
  module: string;
  criterion: string;
  priorityLabel: string;
  priorityScore: number;
  issue: string;
  actionItems: string[];
  evidenceOfImprovement: string;
}

interface ParsedCriterionFeedback {
  criterion: string;
  feedback: string;
}

interface AssignmentMetadataRow {
  submission_id: string;
  assignment_id: string;
  title: string | null;
  module_code: string | null;
  max_score: number | null;
}

const DEMO_PLAN: PlanModule[] = [
  {
    module: "CS301 - Data Structures",
    currentGrade: 61,
    targetGrade: 70,
    trend: "up",
    trendDelta: 9,
    strengths: ["Code Quality", "Tree Traversal Accuracy"],
    weaknesses: ["Complexity Analysis", "Test Coverage"],
    nextSubmissionFocus: [
      "Show time and space complexity explicitly for each major function.",
      "Add edge-case tests for empty, single-node, and unbalanced trees.",
    ],
    tasks: [
      { id: "demo-ds-1", task: "Complete Big-O analysis worksheet", area: "Complexity Analysis", done: false },
      { id: "demo-ds-2", task: "Write 5 extra edge-case tests", area: "Test Coverage", done: false },
      { id: "demo-ds-3", task: "Review lecturer feedback before next lab", area: "Feedback", done: true },
    ],
    weakCriteria: [
      { criterion: "Complexity Analysis", average: 54, attempts: 3 },
      { criterion: "Test Coverage", average: 58, attempts: 2 },
    ],
    chart: [
      { assessment: "A1", score: 54 },
      { assessment: "Quiz", score: 58 },
      { assessment: "Lab", score: 61 },
      { assessment: "A2", score: 63 },
    ],
  },
  {
    module: "CS205 - Algorithms",
    currentGrade: 66,
    targetGrade: 72,
    trend: "down",
    trendDelta: -6,
    strengths: ["Problem Framing", "Presentation"],
    weaknesses: ["Efficiency", "Dynamic Programming Structure"],
    nextSubmissionFocus: [
      "State the recurrence relation before coding the solution.",
      "Compare brute-force and optimized complexity in the write-up.",
    ],
    tasks: [
      { id: "demo-algo-1", task: "Solve 3 dynamic programming exercises", area: "Dynamic Programming Structure", done: false },
      { id: "demo-algo-2", task: "Create a complexity comparison sheet", area: "Efficiency", done: true },
    ],
    weakCriteria: [
      { criterion: "Dynamic Programming Structure", average: 59, attempts: 3 },
      { criterion: "Efficiency", average: 63, attempts: 2 },
    ],
    chart: [
      { assessment: "A1", score: 71 },
      { assessment: "Midterm", score: 68 },
      { assessment: "A2", score: 66 },
      { assessment: "Lab", score: 65 },
    ],
  },
];

const normalizeCriterionLabel = (criterion: string) => {
  const trimmed = criterion.trim();
  if (/^criterion\s+\d+$/i.test(trimmed)) {
    return trimmed.replace(/^criterion/i, "Rubric Criterion");
  }

  return trimmed;
};

const buildFocusHeading = (module: string, criterion: string) => {
  const normalized = normalizeCriterionLabel(criterion);
  const moduleCode = module.split(" - ")[0]?.trim();
  if (moduleCode && /^[A-Z]{2,}\d{2,}$/i.test(moduleCode)) {
    return `${moduleCode}: ${normalized}`;
  }

  return normalized;
};

const normalizeFeedbackText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .trim();

const buildCriterionFeedbackMap = (grade: { ai_feedback?: string; ai_breakdown?: unknown[] } | null | undefined) => {
  const feedbackMap: Record<string, string[]> = {};
  const pushFeedback = (criterion: string, feedback: string | null | undefined) => {
    if (!feedback) return;

    const normalizedCriterion = normalizeCriterionLabel(criterion);
    const normalizedFeedback = normalizeFeedbackText(feedback);
    if (!normalizedCriterion || !normalizedFeedback) return;

    if (!feedbackMap[normalizedCriterion]) {
      feedbackMap[normalizedCriterion] = [];
    }

    if (!feedbackMap[normalizedCriterion].includes(normalizedFeedback)) {
      feedbackMap[normalizedCriterion].push(normalizedFeedback);
    }
  };

  const parsedBreakdown = safeParseGradeBreakdown(grade?.ai_breakdown ?? []);
  if (parsedBreakdown.success) {
    parsedBreakdown.data.forEach((item) => {
      pushFeedback(item.criterion, item.feedback ?? item.comment);
    });
  }

  const parsedExplanation = safeParseExplanationResponse(grade?.ai_feedback);
  if (parsedExplanation.success) {
    parsedExplanation.data.criteria?.forEach((item) => {
      pushFeedback(item.name, item.feedback);
    });
  }

  return feedbackMap;
};

const buildFeedbackLedIssue = (criterion: string, feedback: string | undefined, module: string) => {
  if (!feedback) return buildIssue(criterion, module);

  const firstSentence = normalizeFeedbackText(feedback).split(/(?<=[.!?])\s+/)[0]?.trim();
  return firstSentence || buildIssue(criterion, module);
};

const buildActionItems = (criterion: string, feedback?: string) => {
  const normalized = criterion.toLowerCase();
  const normalizedFeedback = (feedback ?? "").toLowerCase();

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return [
      "compare at least two viewpoints rather than describing only one position",
      "include one concrete example or case that shows the issue in practice",
      "end the section with a clear judgement so your position is explicit",
    ];
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence")
  ) {
    return [
      "add operation outputs or screenshots that show the program working",
      "include at least one edge case alongside the normal path",
      "show the final traversal, sorted output, or resulting state so correctness is visible",
    ];
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return [
      "add 2 stronger quotes or examples",
      "explain exactly what each quote proves rather than leaving it implicit",
      "link each piece of evidence directly back to the claim it supports",
    ];
  }

  if (normalized.includes("complexity")) {
    return [
      "rewrite the time and space complexity for each major function",
      "separate average-case from worst-case behaviour",
      "justify each complexity claim against the actual data structure behaviour",
    ];
  }

  if (normalized.includes("test")) {
    return [
      "add operation outputs",
      "include at least one edge case",
      "show the final traversal or end-state so correctness is visible",
    ];
  }

  if (normalized.includes("evidence")) {
    return [
      "add 2 stronger quotes or examples",
      "explain exactly what each quote proves",
      "link each piece of evidence directly back to the claim it supports",
    ];
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return [
      "include two viewpoints or options being compared",
      "use at least one academic source or supporting concept",
      "finish with a clear judgement, not just description",
    ];
  }

  if (normalized.includes("dynamic programming")) {
    return [
      "state the recurrence relation before coding",
      "show one worked example of the subproblems combining",
      "explain why the chosen state representation is correct",
    ];
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return [
      "use the rubric as a final checklist",
      "make sure every required section includes visible evidence",
      "end with a clear conclusion or judgement rather than stopping at description",
    ];
  }

  return [
    `review the rubric wording for ${normalizeCriterionLabel(criterion)}`,
    "rewrite one weaker section so the intended reasoning is explicit",
    "add a visible example or explanation the marker can directly verify",
  ];
};

const buildIssue = (criterion: string, module: string) => {
  const normalized = criterion.toLowerCase();

  if (normalized.includes("complexity")) {
    return "Your complexity explanation is still too general, especially when average-case and worst-case behaviour need to be separated clearly.";
  }

  if (normalized.includes("test")) {
    return "The submission does not give the marker enough visible test evidence to verify that the implementation is correct in practice.";
  }

  if (normalized.includes("evidence")) {
    return "Your evidence supports the argument too weakly because the examples are not doing enough explicit analytical work.";
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return "This section reads as descriptive rather than evaluative, so the marker cannot clearly see comparison, judgement, or critical weighting.";
  }

  if (normalized.includes("dynamic programming")) {
    return "The solution structure is not fully visible, so the marker cannot clearly follow how the recurrence and subproblems produce the final answer.";
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return `The overall submission quality in ${module} is being held back by missing visible evidence, explanation, or final polish.`;
  }

  return `${normalizeCriterionLabel(criterion)} is lower than your stronger areas because the intended evidence or reasoning is not yet visible enough to the marker.`;
};

const buildEvidenceOfImprovement = (criterion: string, feedback?: string) => {
  const normalized = criterion.toLowerCase();
  const normalizedFeedback = (feedback ?? "").toLowerCase();

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return "The marker can clearly see evaluation rather than description and can identify your final position.";
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence")
  ) {
    return "The marker can verify correctness directly from visible outputs, edge-case evidence, and the final program state.";
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return "Each claim is backed by explicit textual or source-based support rather than unsupported assertion.";
  }

  if (normalized.includes("complexity")) {
    return "Marker can clearly see that each complexity claim is justified and that the higher-risk cases have been evaluated properly.";
  }

  if (normalized.includes("test")) {
    return "Marker can verify correctness directly from visible outputs, an edge case, and the final state of the program.";
  }

  if (normalized.includes("evidence")) {
    return "Each claim is backed by explicit textual or source-based support, not just assertion.";
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return "Marker can clearly see comparison, evaluation, and a defended final judgement rather than description alone.";
  }

  if (normalized.includes("dynamic programming")) {
    return "Marker can follow the recurrence, the worked example, and the logic connecting subproblems to the final answer.";
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return "Marker can clearly see that every required section contains evidence, explanation, and a complete final response.";
  }

  return "Marker can directly see the missing reasoning or evidence that was previously only implied.";
};

const buildEstimatedLift = (average: number) => {
  if (average >= 60) return "+3 to +5 marks";
  if (average >= 50) return "+5 to +8 marks";
  return "+8 to +12 marks";
};

const buildPriorityLabel = (average: number, trend: PlanModule["trend"]) => {
  if (trend === "down" && average < 60) return "High impact, quick win";
  if (trend === "down") return "Needs attention";
  if (average >= 60) return "Quick win";
  return "High impact";
};

const buildResourceRecommendations = (modules: PlanModule[]): Resource[] =>
  modules
    .flatMap((module) =>
      module.weakCriteria.slice(0, 2).map((criterion, index) => {
        const estimatedLift = buildEstimatedLift(criterion.average);
        const priorityScore =
          (100 - criterion.average) +
          (module.trend === "down" ? 10 : module.trend === "steady" ? 5 : 2) +
          Math.min(criterion.attempts * 3, 9);

        return {
          priority: index + 1,
          heading: buildFocusHeading(module.module, criterion.criterion),
          duration: criterion.average >= 60 ? "12 min" : criterion.average >= 50 ? "15 min" : "20 min",
          estimatedLift,
          module: module.module,
          criterion: normalizeCriterionLabel(criterion.criterion),
          issue: buildFeedbackLedIssue(criterion.criterion, criterion.feedback, module.module),
          actionItems: buildActionItems(criterion.criterion, criterion.feedback),
          evidenceOfImprovement: buildEvidenceOfImprovement(criterion.criterion, criterion.feedback),
          priorityLabel: buildPriorityLabel(criterion.average, module.trend),
          priorityScore,
        } satisfies Resource;
      })
    )
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 3)
    .map((resource, index) => ({
      ...resource,
      priority: index + 1,
    }));

const DEMO_RESOURCES: Resource[] = buildResourceRecommendations(DEMO_PLAN);

const InlineProgressBar = ({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className={`overflow-hidden rounded-full bg-secondary ${className}`}>
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

const ImprovementPlan = () => {
  const location = useLocation();
  const { user, isDemo } = useAuth();
  const [plan, setPlan] = useState<PlanModule[]>(isDemo ? DEMO_PLAN : []);
  const [resources, setResources] = useState<Resource[]>(isDemo ? DEMO_RESOURCES : []);
  const [loading, setLoading] = useState(!isDemo);
  const [expandedCompletedModules, setExpandedCompletedModules] = useState<Record<string, boolean>>({});
  const [expandedCompletedCards, setExpandedCompletedCards] = useState<Record<string, boolean>>({});
  const latestPlanRef = useRef<PlanModule[]>(isDemo ? DEMO_PLAN : []);
  const notification = (location.state as { notification?: CommunicationMessage } | null)?.notification;

  useEffect(() => {
    if (isDemo || !user) return;
    void fetchPlan();
  }, [user, isDemo]);

  const fetchPlan = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: submissions }, { data: progressRows }] = await Promise.all([
        supabase
          .from("submissions")
          .select("*")
          .eq("student_id", user.id)
          .order("submitted_at", { ascending: true }),
        supabase
          .from("improvement_plan_progress")
          .select("task_key, completed")
          .eq("student_id", user.id),
      ]);

      if (!submissions || submissions.length === 0) {
        setPlan([]);
        setResources([]);
        latestPlanRef.current = [];
        setLoading(false);
        return;
      }

      const submissionIds = submissions.map((submission) => submission.id);

      const [{ data: grades }, assignmentMetaRes] = await Promise.all([
        supabase.from("grades").select("*").in("submission_id", submissionIds),
        supabase.rpc("get_student_grade_assignment_metadata"),
      ]);

      const assignmentMap: Record<string, any> = {};
      if (assignmentMetaRes.error) {
        log.warn("Improvement plan assignment metadata lookup failed", {
          studentId: user.id,
        });
      } else {
        ((assignmentMetaRes.data || []) as AssignmentMetadataRow[]).forEach((row) => {
          assignmentMap[row.assignment_id] = {
            id: row.assignment_id,
            title: row.title ?? "Assignment title unavailable",
            module_code: row.module_code,
            max_score: row.max_score,
          };
        });
      }

      const gradeMap: Record<string, any> = {};
      (grades || []).forEach((grade) => {
        gradeMap[grade.submission_id] = grade;
      });

      const taskOverrides = Object.fromEntries(
        (progressRows || []).map((row) => [row.task_key, row.completed])
      ) as Record<string, boolean>;
      const moduleBuckets: Record<
        string,
        {
          scores: number[];
          chart: Array<{ assessment: string; score: number }>;
          criterionScores: Record<string, number[]>;
          criterionFeedback: Record<string, string[]>;
        }
      > = {};

      submissions.forEach((submission) => {
        const assignment = assignmentMap[submission.assignment_id] || {
          id: submission.assignment_id,
          title: "Assignment title unavailable",
          module_code: null,
          max_score: null,
        };
        const grade = gradeMap[submission.id];
        const score = grade?.final_score ?? grade?.ai_score;
        if (score == null) return;

        const moduleKey =
          [assignment.module_code, assignment.title].filter(Boolean).join(" - ") ||
          `Assignment ${String(submission.assignment_id).slice(0, 8)}`;
        if (!moduleBuckets[moduleKey]) {
          moduleBuckets[moduleKey] = {
            scores: [],
            chart: [],
            criterionScores: {},
            criterionFeedback: {},
          };
        }

        moduleBuckets[moduleKey].scores.push(score);
        moduleBuckets[moduleKey].chart.push({
          assessment: assignment.title.length > 18 ? `${assignment.title.slice(0, 16)}...` : assignment.title,
          score,
        });

        const breakdown = safeParseGradeBreakdown(grade?.ai_breakdown ?? []);
        if (breakdown.success) {
          breakdown.data.forEach((item) => {
            const criterion = normalizeCriterionLabel(item.criterion || item.name || "Unknown");
            const maxScore = item.max_score ?? item.maxScore ?? 10;
            const percent = maxScore > 0 ? Math.round(((item.score ?? 0) / maxScore) * 100) : 0;
            if (!moduleBuckets[moduleKey].criterionScores[criterion]) {
              moduleBuckets[moduleKey].criterionScores[criterion] = [];
            }
            moduleBuckets[moduleKey].criterionScores[criterion].push(percent);
          });
        }

        const criterionFeedbackMap = buildCriterionFeedbackMap(grade);
        Object.entries(criterionFeedbackMap).forEach(([criterion, snippets]) => {
          if (!moduleBuckets[moduleKey].criterionFeedback[criterion]) {
            moduleBuckets[moduleKey].criterionFeedback[criterion] = [];
          }

          snippets.forEach((snippet) => {
            if (!moduleBuckets[moduleKey].criterionFeedback[criterion].includes(snippet)) {
              moduleBuckets[moduleKey].criterionFeedback[criterion].push(snippet);
            }
          });
        });
      });

      const nextPlan: PlanModule[] = Object.entries(moduleBuckets).map(([module, bucket]) => {
        const currentGrade = Math.round(bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length);
        const firstScore = bucket.scores[0] ?? currentGrade;
        const lastScore = bucket.scores[bucket.scores.length - 1] ?? currentGrade;
        const trendDelta = lastScore - firstScore;
        const trend: PlanModule["trend"] = trendDelta > 3 ? "up" : trendDelta < -3 ? "down" : "steady";

        const criterionAverages = Object.entries(bucket.criterionScores).map(([criterion, values]) => ({
          criterion,
          average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        }));

        const strengths = criterionAverages
          .filter((criterion) => criterion.average >= 70)
          .sort((left, right) => right.average - left.average)
          .slice(0, 2)
          .map((criterion) => criterion.criterion);

        const weaknesses = criterionAverages
          .filter((criterion) => criterion.average < 70)
          .sort((left, right) => left.average - right.average)
          .slice(0, 3)
          .map((criterion) => criterion.criterion);
        const weakCriteria = criterionAverages
          .filter((criterion) => criterion.average < 70)
          .sort((left, right) => left.average - right.average)
          .slice(0, 3)
          .map((criterion) => ({
            criterion: criterion.criterion,
            average: criterion.average,
            attempts: bucket.criterionScores[criterion.criterion]?.length ?? 1,
            feedback: bucket.criterionFeedback[criterion.criterion]?.[0],
          }));

        const nextSubmissionFocus =
          weaknesses.length > 0
            ? weaknesses.map((weakness) => `Improve ${weakness.toLowerCase()} before the next submission.`)
            : ["Maintain your strongest criteria and keep your explanation clear."];

        const tasks = (
          weaknesses.length > 0
            ? weaknesses.map((weakness, index) => ({
                id: `${module}-${weakness}-${index}`.replace(/\s+/g, "-").toLowerCase(),
                task:
                  index === 0
                    ? `Review lecturer feedback for ${weakness}`
                    : index === 1
                      ? `Complete a focused practice task on ${weakness}`
                      : `Prepare a checklist for ${weakness} before the next submission`,
                area: weakness,
                done: false,
              }))
            : [
                {
                  id: `${module}-maintain-strength`.replace(/\s+/g, "-").toLowerCase(),
                  task: "Keep using the approaches that produced your strongest scores",
                  area: "Consistency",
                  done: false,
                },
              ]
        ).map((task) => ({
          ...task,
          done: taskOverrides[task.id] ?? task.done,
        }));

        return {
          module,
          currentGrade,
          targetGrade: Math.max(currentGrade + 8, 70),
          trend,
          trendDelta,
          strengths,
          weaknesses,
          nextSubmissionFocus,
          tasks,
          weakCriteria,
          chart: bucket.chart,
        };
      });

      nextPlan.sort((left, right) => left.currentGrade - right.currentGrade);
      setPlan(nextPlan);
      latestPlanRef.current = nextPlan;

      const nextResources = buildResourceRecommendations(nextPlan);

      setResources(nextResources);
    } catch (error) {
      log.error("Failed to fetch improvement plan", error, {
        studentId: user.id,
      });
      toast.error("Could not load your improvement plan.");
    }
    setLoading(false);
  };

  const toggleCompletedCard = (moduleName: string) => {
    setExpandedCompletedCards((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  const overallTasks = useMemo(() => {
    const allTasks = plan.flatMap((module) => module.tasks);
    const completed = allTasks.filter((task) => task.done).length;
    return {
      total: allTasks.length,
      completed,
      progress: allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0,
    };
  }, [plan]);

  const toggleCompletedSection = (moduleName: string) => {
    setExpandedCompletedModules((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  const toggleCompletedCard = (moduleName: string) => {
    setExpandedCompletedCards((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (plan.length === 0) {
    return (
      <DashboardEmptyState
        title="No improvement plan yet"
        description="Submit and receive graded work to unlock a personalised improvement journey."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {notification && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex gap-3 p-4">
            <Bell className="mt-0.5 h-4 w-4 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{notification.subject}</p>
              <p className="text-xs text-muted-foreground">
                {safeFormatDate(notification.createdAt, "MMM d, yyyy HH:mm")}
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notification.body}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isDemo && (
        <DashboardDemoBanner label="Viewing demo improvement plan data" />
      )}

      <DashboardPageIntro
        eyebrow="Personalised study support"
        title="Improvement Plan"
        description="Focus first on the weakest criteria from your released work, track what you have already completed, and keep the next submission priorities visible."
      />

      <ImprovementPlanOverview
        modulesCount={plan.length}
        completed={overallTasks.completed}
        total={overallTasks.total}
        progress={overallTasks.progress}
      />

      {plan.map((module) => {
        const completed = module.tasks.filter((task) => task.done).length;
        const openTasks = module.tasks.filter((task) => !task.done);
        const completedTasks = module.tasks.filter((task) => task.done);
        const progress = module.tasks.length > 0 ? (completed / module.tasks.length) * 100 : 0;
        const isCompletedSectionExpanded = expandedCompletedModules[module.module] ?? false;
        const isFullyCompleted = module.tasks.length > 0 && openTasks.length === 0;
        const isCompletedCardExpanded = expandedCompletedCards[module.module] ?? false;

        if (isFullyCompleted && !isCompletedCardExpanded) {
          return (
            <Card key={module.module}>
              <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed module plan</p>
                  <p className="text-base font-semibold">{module.module}</p>
                  <p className="text-sm text-muted-foreground">
                    Current {module.currentGrade}% | Target {module.targetGrade}% | {completed}/{module.tasks.length} tasks completed
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/20 text-primary">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Completed
                  </Badge>
                  <Button type="button" variant="outline" size="sm" onClick={() => toggleCompletedCard(module.module)}>
                    Show completed plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={module.module}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">{module.module}</CardTitle>
                  <CardDescription>
                    Current {module.currentGrade}% | Target {module.targetGrade}% |{" "}
                    {module.trend === "up" ? "improving" : module.trend === "down" ? "declining" : "steady"} trend
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm">
                    {module.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : module.trend === "down" ? (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    ) : (
                      <Target className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">
                      {module.trendDelta > 0 ? `+${module.trendDelta}` : module.trendDelta} pts
                    </span>
                  </div>
                  <div className="w-32">
                    <InlineProgressBar value={progress} className="h-2" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {completed}/{module.tasks.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {module.strengths.length > 0 ? (
                          module.strengths.map((strength) => (
                            <Badge key={strength} variant="default">
                              {strength}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Still building enough evidence.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weaknesses</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {module.weaknesses.length > 0 ? (
                          module.weaknesses.map((weakness) => (
                            <Badge key={weakness} variant="outline">
                              {weakness}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No major weak area detected.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">What to improve before your next submission</p>
                    <div className="mt-3 space-y-2">
                      {module.nextSubmissionFocus.map((focus) => (
                        <div key={focus} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{focus}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Grade trend over time</p>
                  <div className="mt-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={module.chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="assessment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke={module.trend === "down" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Track your improvement tasks</p>
                <div className="mt-4 space-y-3">
                  {openTasks.length > 0 ? openTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <Checkbox checked={task.done} onCheckedChange={() => toggleTask(module.module, task.id)} />
                      <div className="space-y-1">
                        <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
                          {task.task}
                        </p>
                        <p className="text-xs text-muted-foreground">{task.area}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                      All current tasks are completed for this module.
                    </div>
                  )}
                </div>

                {completedTasks.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto px-0 text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => toggleCompletedSection(module.module)}
                      >
                        {isCompletedSectionExpanded ? "Hide completed tasks" : `Show completed tasks (${completedTasks.length})`}
                      </Button>
                      {isFullyCompleted && (
                        <Button type="button" variant="outline" size="sm" onClick={() => toggleCompletedCard(module.module)}>
                          Collapse module
                        </Button>
                      )}
                    </div>
                    {isCompletedSectionExpanded && (
                      <div className="mt-3 space-y-3">
                        {completedTasks.map((task) => (
                          <div key={task.id} className="flex items-start gap-3">
                            <Checkbox checked={task.done} onCheckedChange={() => toggleTask(module.module, task.id)} />
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground line-through">
                                {task.task}
                              </p>
                              <p className="text-xs text-muted-foreground">{task.area}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Best Next Moves</CardTitle>
          </div>
          <CardDescription>Prioritised from your weakest repeated criteria so you know what to fix first before the next submission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {resources.map((resource) => (
            <div key={`${resource.heading}-${resource.module}`} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    Priority {resource.priority} - {resource.heading}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{resource.priorityLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {resource.estimatedLift} | ~{resource.duration}
                  </p>
                </div>
                <Badge variant="outline">{resource.module}</Badge>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue</p>
                  <p className="mt-1 text-sm">{resource.issue}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                  <div className="mt-2 space-y-2">
                    {resource.actionItems.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence of improvement</p>
                  <p className="mt-1 text-sm">{resource.evidenceOfImprovement}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImprovementPlan;
