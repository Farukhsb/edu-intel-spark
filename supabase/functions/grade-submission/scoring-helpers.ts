import type { GradeAIResponse } from "../_shared/grade-ai-response.ts";
import { GRADING_PROMPT_VERSION, REGRADING_DRIFT_THRESHOLD_MIN, REGRADING_DRIFT_THRESHOLD_RATIO } from "./constants.ts";
import {
  clampConfidence,
  normalizeBreakdown,
  normalizeOverallScore,
  type NormalizedBreakdown,
} from "./normalization.ts";
import type { RubricCriterion } from "./prompting.ts";

export type GradingCandidate = {
  gradeResult: GradeAIResponse;
  normalized: NormalizedBreakdown;
  modelScore: number | null;
  modelFeedback: string;
  scoreAdjusted: boolean;
  positiveFeedbackLowScoreMismatch: boolean;
};

export type ExistingGradeRecordWithMeta = {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: unknown;
  grading_confidence?: number | null;
  grading_metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type FingerprintGradeCluster = {
  fingerprint: string;
  canonicalGrade: ExistingGradeRecordWithMeta;
  gradeCount: number;
  scoreSpread: number;
};

const PROMPT_INJECTION_PATTERNS = [
  "ignore previous instructions",
  "ignore the above",
  "ignore all prior",
  "system prompt",
  "developer message",
  "assistant message",
  "you are chatgpt",
  "reveal the prompt",
  "print the prompt",
  "chain of thought",
  "follow these instructions",
  "override instructions",
  "do not follow",
];

function normalizeFingerprintText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function normalizeHistoryItem(item: Record<string, unknown>) {
  return {
    previous_score: item.previous_score == null ? null : Number(item.previous_score),
    new_score: item.new_score == null ? null : Number(item.new_score),
    previous_confidence: item.previous_confidence == null ? null : Number(item.previous_confidence),
    new_confidence: item.new_confidence == null ? null : Number(item.new_confidence),
    grading_input_hash: typeof item.grading_input_hash === "string" ? item.grading_input_hash : "",
    prompt_version: typeof item.prompt_version === "string" ? item.prompt_version : "",
    timestamp: typeof item.timestamp === "string" ? item.timestamp : "",
    reason_for_regrade: typeof item.reason_for_regrade === "string" ? item.reason_for_regrade : "",
  };
}

export function normalizeHistory(metadata: Record<string, unknown> | null | undefined) {
  if (!Array.isArray(metadata?.grading_history)) return [];
  return metadata.grading_history
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map(normalizeHistoryItem)
    .filter((item) => item.grading_input_hash);
}

export function detectPositiveFeedbackLowScoreMismatch(feedback: string, score: number, maxScore: number) {
  const normalizedFeedback = feedback.toLowerCase();
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const positiveSignals = [
    "solid",
    "meets the core requirements",
    "meets core requirements",
    "meets all core requirements",
    "meets requirements",
    "good",
    "clear",
    "relevant",
    "applies required techniques correctly",
    "applies the required techniques correctly",
    "solid report",
    "competent engagement",
    "competent analysis",
    "clear preprocessing",
    "two analytical techniques",
    "logical conclusion",
    "logical interpretation",
    "reasonable interpretation",
    "strongest evidence",
  ];

  return ratio < 0.4 && positiveSignals.some((signal) => normalizedFeedback.includes(signal));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildGradingInputHash(params: {
  submissionText: string;
  rubric: RubricCriterion[];
  assignmentInstructions: string;
  maxScore: number;
  promptVersion?: string;
}) {
  const promptVersion = params.promptVersion ?? GRADING_PROMPT_VERSION;
  return await sha256Hex(
    [
      params.submissionText,
      JSON.stringify(params.rubric),
      params.assignmentInstructions,
      String(params.maxScore),
      promptVersion,
    ].join("\n---\n"),
  );
}

export function hasMeaningfulScoreDrift(previousScore: number, nextScore: number, maxScore: number) {
  const threshold = Math.max(REGRADING_DRIFT_THRESHOLD_MIN, Math.round(maxScore * REGRADING_DRIFT_THRESHOLD_RATIO));
  return Math.abs(previousScore - nextScore) >= threshold;
}

export function buildGradingCandidate(
  gradeResult: GradeAIResponse,
  rubric: RubricCriterion[],
  assignmentMaxScore: number,
): GradingCandidate {
  const normalized = normalizeBreakdown(gradeResult.criteria ?? gradeResult.breakdown, rubric);
  const modelScore = normalizeOverallScore(gradeResult.total_score ?? gradeResult.score, assignmentMaxScore);
  const modelFeedback =
    typeof (gradeResult.overall_feedback ?? gradeResult.feedback) === "string" &&
      String(gradeResult.overall_feedback ?? gradeResult.feedback).trim()
      ? String(gradeResult.overall_feedback ?? gradeResult.feedback).trim()
      : "No detailed feedback was returned.";
  const scoreAdjusted = modelScore != null && Math.abs(modelScore - normalized.total) > 1;
  const positiveFeedbackLowScoreMismatch = detectPositiveFeedbackLowScoreMismatch(
    modelFeedback,
    normalized.total,
    assignmentMaxScore,
  );

  return {
    gradeResult,
    normalized,
    modelScore,
    modelFeedback,
    scoreAdjusted,
    positiveFeedbackLowScoreMismatch,
  };
}

export function chooseCanonicalFingerprintGrade(grades: ExistingGradeRecordWithMeta[]): FingerprintGradeCluster | null {
  const scoredGrades = grades.filter((grade) => grade.ai_score != null).map((grade) => ({
    grade,
    score: Number(grade.ai_score),
    confidence: clampConfidence(grade.grading_confidence),
    createdAt: grade.created_at ? new Date(grade.created_at).getTime() : 0,
  }));

  if (scoredGrades.length === 0) return null;

  const sortedScores = scoredGrades.map((entry) => entry.score).sort((a, b) => a - b);
  const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];
  const canonical = [...scoredGrades].sort((a, b) => {
    const distanceDiff = Math.abs(a.score - medianScore) - Math.abs(b.score - medianScore);
    if (distanceDiff !== 0) return distanceDiff;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.createdAt - a.createdAt;
  })[0];

  const fingerprint =
    typeof canonical.grade.grading_metadata?.content_fingerprint === "string"
      ? canonical.grade.grading_metadata.content_fingerprint
      : "";

  return {
    fingerprint,
    canonicalGrade: canonical.grade,
    gradeCount: scoredGrades.length,
    scoreSpread: Math.max(...sortedScores) - Math.min(...sortedScores),
  };
}

export function detectPromptInjectionRisk(text: string) {
  const normalized = text.toLowerCase();
  const matchedSignals = PROMPT_INJECTION_PATTERNS.filter((signal) => normalized.includes(signal));
  return {
    hasRisk: matchedSignals.length > 0,
    signals: matchedSignals,
  };
}
