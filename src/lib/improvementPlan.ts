import { safeParseExplanationResponse, safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";

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

const normalizeFeedbackText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .trim();

const buildGuidanceMode = (score: number): GuidanceMode => (score < 40 ? "recovery" : "future");

const buildGuidanceLabel = (mode: GuidanceMode) =>
  mode === "recovery" ? "Recovery plan" : "Future improvement plan";

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

const buildModuleContext = (module: string) => {
  const [moduleCode, ...titleParts] = module.split(" - ");
  const title = titleParts.join(" - ").trim();

  if (moduleCode && title) {
    return {
      assignmentRef: `${moduleCode} assignment`,
      moduleRef: `${moduleCode} submission`,
      title,
    };
  }

  return {
    assignmentRef: "this assignment",
    moduleRef: "this submission",
    title: module,
  };
};

const CONCEPT_HINT_PATTERNS: Array<{ pattern: RegExp; formatter?: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /\bdiscussion of ([A-Za-z][A-Za-z-]*(?: [A-Za-z][A-Za-z-]*){0,3})\b/i,
    formatter: (match) => match[1],
  },
  {
    pattern: /\bexplanation of ([A-Za-z][A-Za-z-]*(?: [A-Za-z][A-Za-z-]*){0,3})\b/i,
    formatter: (match) => match[1],
  },
  {
    pattern: /\b(BST [A-Za-z-]+(?: and [A-Za-z-]+){0,2} logic)\b/i,
  },
  { pattern: /\b(BST (?:deletion|insertion|traversal|implementation|correctness))\b/i },
  { pattern: /\b(hash table (?:deletion|insertion|collision handling|lookup|complexity))\b/i },
  { pattern: /\b(fairness risk|automated grading bias|AI bias in assessment|bias in assessment)\b/i },
  { pattern: /\b(dynamic programming (?:state representation|recurrence|structure))\b/i },
  { pattern: /\b(time complexity|space complexity|worst-case behaviour|average-case behaviour)\b/i },
  { pattern: /\b(sorted traversal|operation outputs|test output|edge case)\b/i },
  {
    pattern: /\b([A-Za-z][A-Za-z-]*(?: [A-Za-z][A-Za-z-]*){0,2}) (?:is|are) not (?:shown|visible|demonstrated)\b/i,
    formatter: (match) => match[1],
  },
];

const normalizeConceptHint = (value: string) =>
  value
    .replace(/^(the|your)\s+/i, "")
    .replace(/\s+\b(is|are|was|were)\b$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/g, "");

const extractConceptHint = (feedback: string) => {
  const normalizedFeedback = normalizeFeedbackText(feedback);

  for (const { pattern, formatter } of CONCEPT_HINT_PATTERNS) {
    const match = normalizedFeedback.match(pattern);
    if (!match) continue;

    const raw = formatter ? formatter(match) : match[1] ?? match[0];
    const conceptHint = normalizeConceptHint(raw);
    if (conceptHint.length >= 4 && conceptHint.length <= 60) {
      return conceptHint;
    }
  }

  return null;
};

const buildConceptVerb = (conceptLead: string) => {
  if (conceptLead.includes(" and ")) {
    return "are";
  }

  return "is";
};

const buildConceptPhrase = (conceptHint: string | null, fallback: string) =>
  conceptHint ? `your ${conceptHint.toLowerCase()}` : fallback;

const buildConceptObjectPhrase = (conceptHint: string | null, fallback: string) =>
  conceptHint ? conceptHint.toLowerCase() : normalizeCriterionLabel(fallback).toLowerCase();

const buildFeedbackSignal = (feedback: string | undefined) => {
  const normalized = normalizeFeedbackText(feedback ?? "");
  if (!normalized) return "No direct feedback snippet available.";
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

const buildIssue = (criterion: string, module: string, mode: GuidanceMode) => {
  const normalized = criterion.toLowerCase();
  const timeframe =
    mode === "recovery"
      ? "To recover this submission, "
      : "For future assignments, ";

  if (normalized.includes("complexity")) {
    return `${timeframe}your complexity explanation needs clearer separation between average-case and worst-case behaviour.`;
  }

  if (normalized.includes("test")) {
    return `${timeframe}the marker still cannot see enough visible test evidence to verify that the implementation works in practice.`;
  }

  if (normalized.includes("evidence")) {
    return `${timeframe}your evidence needs to do more analytical work so the support for each claim is explicit.`;
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return `${timeframe}this area still reads as descriptive rather than evaluative, so the marker cannot clearly see comparison, judgement, or critical weighting.`;
  }

  if (normalized.includes("dynamic programming")) {
    return `${timeframe}the solution structure is not visible enough for the marker to follow how the recurrence and subproblems produce the final answer.`;
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return `${timeframe}the overall submission quality in ${module} is being held back by missing visible evidence, explanation, or final polish.`;
  }

  return `${timeframe}${normalizeCriterionLabel(criterion)} is weaker than your stronger areas because the intended evidence or reasoning is not yet visible enough to the marker.`;
};

const buildIssueFromFeedback = (
  criterion: string,
  feedback: string,
  module: string,
  mode: GuidanceMode,
) => {
  const normalizedFeedback = normalizeFeedbackText(feedback).toLowerCase();
  const normalizedCriterion = normalizeCriterionLabel(criterion);
  const lowerCriterion = normalizedCriterion.toLowerCase();
  const moduleContext = buildModuleContext(module);
  const conceptHint = extractConceptHint(feedback);
  const conceptLead = buildConceptPhrase(conceptHint, lowerCriterion);
  const conceptVerb = buildConceptVerb(conceptLead);

  if (
    normalizedFeedback.includes("not shown") ||
    normalizedFeedback.includes("not visible") ||
    normalizedFeedback.includes("not demonstrated") ||
    normalizedFeedback.includes("no visible test")
  ) {
    return `In your ${moduleContext.moduleRef}, ${conceptLead} ${conceptVerb} not visibly demonstrated, so the marker could not verify it clearly.`;
  }

  if (
    normalizedFeedback.includes("too descriptive") ||
    normalizedFeedback.includes("lacks evaluation") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return `In your ${moduleContext.assignmentRef}, ${conceptLead} describes concepts but does not evaluate them clearly enough for the marker to see a defended judgement.`;
  }

  if (
    normalizedFeedback.includes("missing evidence") ||
    normalizedFeedback.includes("no examples") ||
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("textual support")
  ) {
    return `In your ${moduleContext.assignmentRef}, ${conceptLead} is not supported by explicit evidence, so the marker cannot clearly see how each claim is justified.`;
  }

  if (
    normalizedFeedback.includes("simplified") ||
    normalizedFeedback.includes("not precise") ||
    normalizedFeedback.includes("too simple")
  ) {
    return `In your ${moduleContext.assignmentRef}, ${conceptLead} lacks precision, especially in the more exact technical or analytical details the marker expects to see.`;
  }

  if (mode === "recovery") {
    return `In your ${moduleContext.moduleRef}, ${lowerCriterion} still needs a clearer fix against the rubric because the marker could not yet see the required reasoning or evidence.`;
  }

  return `In your ${moduleContext.assignmentRef}, ${lowerCriterion} is still weaker than your stronger areas because the marker could not clearly see the intended reasoning or evidence.`;
};

const buildFeedbackLedIssue = (criterion: string, feedback: string | undefined, module: string, mode: GuidanceMode) => {
  if (!feedback) return buildIssue(criterion, module, mode);
  return buildIssueFromFeedback(criterion, feedback, module, mode) || buildIssue(criterion, module, mode);
};

const buildActionItems = (
  criterion: string,
  feedback: string | undefined,
  mode: GuidanceMode,
  conceptHint: string | null,
) => {
  const normalized = criterion.toLowerCase();
  const normalizedFeedback = (feedback ?? "").toLowerCase();
  const futurePrefix = "For future assignments, ";
  const recoveryPrefix = "For resubmission, ";
  const prefix = mode === "recovery" ? recoveryPrefix : futurePrefix;
  const conceptObject = buildConceptObjectPhrase(conceptHint, criterion);

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return [
      `${prefix}rewrite ${conceptObject} so it compares at least two viewpoints rather than describing only one position`,
      `${prefix}include one concrete example or case that shows the issue in practice`,
      `${prefix}end the section with a clear judgement so your position is explicit`,
    ];
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence") ||
    normalizedFeedback.includes("test output")
  ) {
    return [
      `${prefix}add operation outputs or screenshots that show ${conceptObject} working`,
      `${prefix}include at least one edge case alongside the normal path`,
      `${prefix}show the final traversal, sorted output, or resulting state so correctness is visible`,
    ];
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return [
      `${prefix}add 2 stronger quotes or examples that directly support ${conceptObject}`,
      `${prefix}explain exactly what each quote proves rather than leaving it implicit`,
      `${prefix}link each piece of evidence directly back to the claim it supports`,
    ];
  }

  if (normalized.includes("complexity")) {
    return [
      `${prefix}rewrite the time and space complexity for ${conceptObject}`,
      `${prefix}separate average-case from worst-case behaviour`,
      `${prefix}justify each complexity claim against the actual data structure behaviour`,
    ];
  }

  if (normalized.includes("test")) {
    return [
      `${prefix}add operation outputs that demonstrate ${conceptObject}`,
      `${prefix}include at least one edge case`,
      `${prefix}show the final traversal or end-state so correctness is visible`,
    ];
  }

  if (normalized.includes("evidence")) {
    return [
      `${prefix}add 2 stronger quotes or examples for ${conceptObject}`,
      `${prefix}explain exactly what each quote proves`,
      `${prefix}link each piece of evidence directly back to the claim it supports`,
    ];
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return [
      `${prefix}rewrite ${conceptObject} so it includes two viewpoints or options being compared`,
      `${prefix}use at least one academic source or supporting concept`,
      `${prefix}finish with a clear judgement, not just description`,
    ];
  }

  if (normalized.includes("dynamic programming")) {
    return [
      `${prefix}state the recurrence relation for ${conceptObject} before coding`,
      `${prefix}show one worked example of the subproblems combining`,
      `${prefix}explain why the chosen state representation is correct`,
    ];
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return [
      `${prefix}use the rubric as a final checklist`,
      `${prefix}make sure every required section includes visible evidence`,
      `${prefix}end with a clear conclusion or judgement rather than stopping at description`,
    ];
  }

  return [
    `${prefix}review the rubric wording for ${normalizeCriterionLabel(criterion)}`,
    `${prefix}rewrite one weaker section so the intended reasoning is explicit`,
    `${prefix}add a visible example or explanation the marker can directly verify`,
  ];
};

const buildEvidenceOfImprovement = (criterion: string, feedback: string | undefined, mode: GuidanceMode) => {
  const normalized = criterion.toLowerCase();
  const normalizedFeedback = (feedback ?? "").toLowerCase();
  const timeframe =
    mode === "recovery"
      ? "This will help the resubmission meet the rubric minimums more clearly."
      : "This will strengthen the same skill on future assignments.";

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return `The marker can clearly see evaluation rather than description and can identify your final position. ${timeframe}`;
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence") ||
    normalizedFeedback.includes("test output")
  ) {
    return `The marker can verify correctness directly from visible outputs, edge-case evidence, and the final program state. ${timeframe}`;
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return `Each claim is backed by explicit textual or source-based support rather than unsupported assertion. ${timeframe}`;
  }

  if (normalized.includes("complexity")) {
    return `Marker can clearly see that each complexity claim is justified and that the higher-risk cases have been evaluated properly. ${timeframe}`;
  }

  if (normalized.includes("test")) {
    return `Marker can verify correctness directly from visible outputs, an edge case, and the final state of the program. ${timeframe}`;
  }

  if (normalized.includes("evidence")) {
    return `Each claim is backed by explicit textual or source-based support, not just assertion. ${timeframe}`;
  }

  if (normalized.includes("analysis") || normalized.includes("comparison")) {
    return `Marker can clearly see comparison, evaluation, and a defended final judgement rather than description alone. ${timeframe}`;
  }

  if (normalized.includes("dynamic programming")) {
    return `Marker can follow the recurrence, the worked example, and the logic connecting subproblems to the final answer. ${timeframe}`;
  }

  if (normalized.includes("report") || normalized.includes("quality") || normalized.includes("overall")) {
    return `Marker can clearly see that every required section contains evidence, explanation, and a complete final response. ${timeframe}`;
  }

  return `Marker can directly see the missing reasoning or evidence that was previously only implied. ${timeframe}`;
};

const buildWeakestCriterionSummary = (criterion: WeakCriterionInsight) =>
  `Weakest criterion: ${normalizeCriterionLabel(criterion.criterion)} (${(100 - criterion.average).toFixed(1).replace(/\.0$/, "")}% loss)`;

const buildNextSubmissionFocus = (
  criterion: string,
  feedback: string | undefined,
  mode: GuidanceMode,
) => {
  const normalizedFeedback = (feedback ?? "").toLowerCase();
  const normalizedCriterion = normalizeCriterionLabel(criterion);

  if (
    normalizedFeedback.includes("descriptive") ||
    normalizedFeedback.includes("not evaluative") ||
    normalizedFeedback.includes("does not clearly evaluate")
  ) {
    return mode === "recovery"
      ? `Recover ${normalizedCriterion.toLowerCase()} by turning description into evaluation with comparison, evidence, and a final judgement.`
      : `Strengthen ${normalizedCriterion.toLowerCase()} next time by turning description into evaluation with comparison, evidence, and a final judgement.`;
  }

  if (
    normalizedFeedback.includes("no visible test") ||
    normalizedFeedback.includes("visible testing") ||
    normalizedFeedback.includes("output evidence")
  ) {
    return mode === "recovery"
      ? `Recover ${normalizedCriterion.toLowerCase()} by adding visible outputs, an edge case, and a final program state the marker can verify.`
      : `Improve ${normalizedCriterion.toLowerCase()} next time by adding visible outputs, an edge case, and a final program state the marker can verify.`;
  }

  if (
    normalizedFeedback.includes("supports claims weakly") ||
    normalizedFeedback.includes("evidence supports") ||
    normalizedFeedback.includes("textual support")
  ) {
    return mode === "recovery"
      ? `Recover ${normalizedCriterion.toLowerCase()} by adding stronger evidence and explaining exactly what each example proves.`
      : `Improve ${normalizedCriterion.toLowerCase()} next time by adding stronger evidence and explaining exactly what each example proves.`;
  }

  return mode === "recovery"
    ? `Recover ${normalizedCriterion.toLowerCase()} by making the intended reasoning and evidence more explicit against the rubric.`
    : `Improve ${normalizedCriterion.toLowerCase()} next time by making the intended reasoning and evidence more explicit against the rubric.`;
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
        const guidanceMode = module.guidanceMode ?? buildGuidanceMode(module.currentGrade);
        const conceptHint = criterion.feedback ? extractConceptHint(criterion.feedback) : null;
        const priorityScore =
          (100 - criterion.average) +
          (module.trend === "down" ? 10 : module.trend === "steady" ? 5 : 2) +
          Math.min(criterion.attempts * 3, 9);

        return {
          priority: index + 1,
          heading: buildFocusHeading(module.module, criterion.criterion),
          duration: buildDuration(criterion),
          estimatedLift,
          guidanceMode,
          guidanceLabel: buildGuidanceLabel(guidanceMode),
          module: module.module,
          criterion: normalizeCriterionLabel(criterion.criterion),
          weakestCriterionSummary: buildWeakestCriterionSummary(criterion),
          feedbackSignal: buildFeedbackSignal(criterion.feedback),
          conceptHint,
          issue: buildFeedbackLedIssue(criterion.criterion, criterion.feedback, module.module, guidanceMode),
          actionItems: buildActionItems(criterion.criterion, criterion.feedback, guidanceMode, conceptHint),
          evidenceOfImprovement: buildEvidenceOfImprovement(criterion.criterion, criterion.feedback, guidanceMode),
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
