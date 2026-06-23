import { safeParseExplanationResponse, safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";
import type { GuidanceMode, ImprovementPlanGradeLike, PlanModule } from "@/lib/improvementPlanTypes";

const normalizeFeedbackText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .trim();

export const buildGuidanceMode = (score: number): GuidanceMode => (score < 40 ? "recovery" : "future");

export const buildGuidanceLabel = (mode: GuidanceMode) =>
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

const getModuleContext = (module: string) => {
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
  { pattern: /\b(BST [A-Za-z-]+(?: and [A-Za-z-]+){0,2} logic)\b/i },
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

export const extractConceptHint = (feedback: string) => {
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

export const buildConceptVerb = (conceptLead: string) => {
  if (conceptLead.includes(" and ")) {
    return "are";
  }

  return "is";
};

export const buildConceptPhrase = (conceptHint: string | null, fallback: string) =>
  conceptHint ? `your ${conceptHint.toLowerCase()}` : fallback;

export const buildConceptObjectPhrase = (conceptHint: string | null, fallback: string) =>
  conceptHint ? conceptHint.toLowerCase() : normalizeCriterionLabel(fallback).toLowerCase();

export const buildFeedbackSignal = (feedback: string | undefined) => {
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

export { normalizeFeedbackText };
export { getModuleContext as buildModuleContext };
