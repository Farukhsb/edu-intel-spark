import { safeParseExplanationResponse, safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";

export interface ImprovementTask {
  id: string;
  task: string;
  area: string;
  done: boolean;
}

export type PlanTrend = "up" | "down" | "steady";

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
  module: string;
  criterion: string;
  priorityLabel: string;
  priorityScore: number;
  evidenceStrength: "strong" | "moderate" | "limited";
  evidenceBasis: string;
  issue: string;
  actionItems: string[];
  evidenceOfImprovement: string;
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

const normalizeFeedbackText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .trim();

export const normalizeCriterionLabel = (criterion: string) => {
  const trimmed = criterion.trim();
  if (/^criterion\s+\d+$/i.test(trimmed)) {
    return trimmed.replace(/^criterion/i, "Rubric Criterion");
  }

  return trimmed;
};

export const buildFocusHeading = (module: string, criterion: string) => {
  const normalized = normalizeCriterionLabel(criterion);
  const moduleCode = module.split(" - ")[0]?.trim();
  if (moduleCode && /^[A-Z]{2,}\d{2,}$/i.test(moduleCode)) {
    return `${moduleCode}: ${normalized}`;
  }

  return normalized;
};

export const buildCriterionFeedbackMap = (
  grade: Pick<ImprovementPlanGradeLike, "ai_feedback" | "ai_breakdown"> | null | undefined,
) => {
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
  if (average >= 60) return "Good recovery opportunity";
  if (average >= 50) return "Strong recovery opportunity";
  return "High recovery opportunity";
};

const buildPriorityLabel = (average: number, trend: PlanTrend) => {
  if (trend === "down" && average < 60) return "High impact, quick win";
  if (trend === "down") return "Needs attention";
  if (average >= 60) return "Quick win";
  return "High impact";
};

const buildEvidenceStrength = (criterion: WeakCriterionInsight): "strong" | "moderate" | "limited" => {
  const feedback = normalizeFeedbackText(criterion.feedback ?? "");
  const hasFeedback = feedback.length > 0;
  const looksSpecific =
    feedback.length >= 40 ||
    /(no visible|not clearly|descriptive|evaluative|supports claims|edge case|output evidence|average-case|worst-case)/i.test(feedback);

  if (hasFeedback && looksSpecific && criterion.attempts >= 1) {
    return "strong";
  }

  if (hasFeedback || criterion.attempts >= 2) {
    return "moderate";
  }

  return "limited";
};

const buildEvidenceBasis = (criterion: WeakCriterionInsight) => {
  const evidenceStrength = buildEvidenceStrength(criterion);
  if (evidenceStrength === "strong") {
    return "Based on direct criterion feedback from graded work.";
  }
  if (evidenceStrength === "moderate") {
    return "Based on repeated low criterion scores with some supporting feedback.";
  }
  return "Based on limited evidence from current graded work, so this guidance is intentionally broad.";
};

const buildDuration = (criterion: WeakCriterionInsight) => {
  const evidenceStrength = buildEvidenceStrength(criterion);
  if (evidenceStrength === "limited") return "short review";
  if (criterion.average >= 60) return "12 min review";
  if (criterion.average >= 50) return "15 min review";
  return "20 min review";
};

export const buildResourceRecommendations = (modules: PlanModule[]): Resource[] =>
  modules
    .flatMap((module) =>
      module.weakCriteria.slice(0, 2).map((criterion, index) => {
        const estimatedLift = buildEstimatedLift(criterion.average);
        const evidenceStrength = buildEvidenceStrength(criterion);
        const priorityScore =
          (100 - criterion.average) +
          (module.trend === "down" ? 10 : module.trend === "steady" ? 5 : 2) +
          Math.min(criterion.attempts * 3, 9);

        return {
          priority: index + 1,
          heading: buildFocusHeading(module.module, criterion.criterion),
          duration: buildDuration(criterion),
          estimatedLift,
          module: module.module,
          criterion: normalizeCriterionLabel(criterion.criterion),
          issue: buildFeedbackLedIssue(criterion.criterion, criterion.feedback, module.module),
          actionItems: buildActionItems(criterion.criterion, criterion.feedback),
          evidenceOfImprovement: buildEvidenceOfImprovement(criterion.criterion, criterion.feedback),
          priorityLabel: buildPriorityLabel(criterion.average, module.trend),
          priorityScore,
          evidenceStrength,
          evidenceBasis: buildEvidenceBasis(criterion),
        } satisfies Resource;
      }),
    )
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 3)
    .map((resource, index) => ({
      ...resource,
      priority: index + 1,
    }));

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
