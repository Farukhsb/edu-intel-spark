import { safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";
import {
  buildCriterionFeedbackMap,
  buildGuidanceMode,
  buildNextSubmissionFocus,
  normalizeCriterionLabel,
} from "@/lib/improvementPlanHelpers";

export interface ImprovementTask {
  id: string;
  task: string;
  area: string;
  done: boolean;
}

export type PlanTrend = "up" | "down" | "steady";
export type GuidanceMode = "future" | "recovery";

export interface WeakCriterionInsight {
  criterion: string;
  average: number;
  attempts: number;
  feedback?: string;
}

export interface PlanModule {
  module: string;
  currentGrade: number;
  targetGrade: number;
  guidanceMode: GuidanceMode;
  trend: PlanTrend;
  trendDelta: number;
  strengths: string[];
  weaknesses: string[];
  nextSubmissionFocus: string[];
  tasks: ImprovementTask[];
  chart: Array<{ assessment: string; score: number }>;
  weakCriteria: WeakCriterionInsight[];
}

export interface Resource {
  priority: number;
  heading: string;
  duration: string;
  estimatedLift: string;
  guidanceMode: GuidanceMode;
  guidanceLabel: string;
  module: string;
  criterion: string;
  priorityLabel: string;
  priorityScore: number;
  evidenceStrength: "strong" | "moderate" | "limited";
  evidenceBasis: string;
  weakestCriterionSummary: string;
  feedbackSignal: string;
  conceptHint: string | null;
  issue: string;
  actionItems: string[];
  evidenceOfImprovement: string;
}

export interface ImprovementPlanReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export interface AssignmentMetadataRow {
  submission_id: string;
  assignment_id: string;
  title: string | null;
  module_code: string | null;
  max_score: number | null;
}

export interface ImprovementPlanSubmissionLike {
  id: string;
  assignment_id: string;
  submitted_at: string;
}

export interface ImprovementPlanAssignmentLike {
  id: string;
  title: string;
  module_code: string | null;
  max_score: number | null;
}

export interface ImprovementPlanGradeLike {
  submission_id: string;
  final_score?: number | null;
  ai_score?: number | null;
  ai_feedback?: string | null;
  ai_breakdown?: unknown[] | null;
}

export {
  buildCriterionFeedbackMap,
  buildGuidanceMode,
  buildNextSubmissionFocus,
  normalizeCriterionLabel,
  buildResourceRecommendations,
} from "@/lib/improvementPlanHelpers";

export const buildPlanModules = ({
  submissions,
  grades,
  assignmentMap,
  taskOverrides,
}: {
  submissions: ImprovementPlanSubmissionLike[];
  grades: ImprovementPlanGradeLike[];
  assignmentMap: Record<string, ImprovementPlanAssignmentLike>;
  taskOverrides: Record<string, boolean>;
}) => {
  const gradeMap: Record<string, ImprovementPlanGradeLike> = {};
  grades.forEach((grade) => {
    gradeMap[grade.submission_id] = grade;
  });

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

  return Object.entries(moduleBuckets)
    .map(([module, bucket]) => {
      const currentGrade = Math.round(bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length);
      const guidanceMode = buildGuidanceMode(currentGrade);
      const firstScore = bucket.scores[0] ?? currentGrade;
      const lastScore = bucket.scores[bucket.scores.length - 1] ?? currentGrade;
      const trendDelta = lastScore - firstScore;
      const trend: PlanTrend = trendDelta > 3 ? "up" : trendDelta < -3 ? "down" : "steady";

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
          ? weakCriteria.slice(0, 2).map((criterion) =>
              buildNextSubmissionFocus(criterion.criterion, criterion.feedback, guidanceMode),
            )
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
        guidanceMode,
        trend,
        trendDelta,
        strengths,
        weaknesses,
        nextSubmissionFocus,
        tasks,
        weakCriteria,
        chart: bucket.chart,
      } satisfies PlanModule;
    })
    .sort((left, right) => left.currentGrade - right.currentGrade);
};

export const getOverallTaskSummary = (plan: PlanModule[]) => {
  const allTasks = plan.flatMap((module) => module.tasks);
  const completed = allTasks.filter((task) => task.done).length;

  return {
    total: allTasks.length,
    completed,
    progress: allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0,
  };
};

export const getImprovementPlanReadiness = ({
  plan,
  resources,
  overallTasks,
}: {
  plan: PlanModule[];
  resources: Resource[];
  overallTasks: { total: number; completed: number; progress: number };
}): ImprovementPlanReadiness => {
  const firstOpenTaskEntry =
    plan
      .flatMap((module) => module.tasks.filter((task) => !task.done).map((task) => ({ module: module.module, task })))
      .at(0) ?? null;
  const firstPriorityResource = resources[0] ?? null;

  if (firstPriorityResource && firstOpenTaskEntry) {
    return {
      postureLabel: "You have active improvement work",
      likelyChallenge: `${firstPriorityResource.heading} is still the highest-priority improvement area`,
      bestNextAction: `Complete ${firstOpenTaskEntry.task.task} before the next submission window`,
    };
  }

  if (plan.length > 0 && overallTasks.total > 0 && overallTasks.completed === overallTasks.total) {
    return {
      postureLabel: "You have completed the current tasks",
      likelyChallenge: firstPriorityResource
        ? `${firstPriorityResource.heading} still needs to stay visible in your next piece of work`
        : "Your recent support tasks are complete, but the next submission still needs deliberate follow-through",
      bestNextAction: "Carry the strongest improvement points into your next submission instead of starting from scratch",
    };
  }

  return {
    postureLabel: "No active improvement tasks yet",
    likelyChallenge: "No personalised improvement tasks are active yet",
    bestNextAction: "Receive released feedback first so the platform can build a focused support plan",
  };
};
