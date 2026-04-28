import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  logDocumentExtractionResult,
  extractSubmissionDocument,
} from "../_shared/document-extraction.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";
import { applyRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import { classifyAssignmentType, type AssignmentType } from "../_shared/text-analysis.ts";

const CONFIDENCE_THRESHOLD = 0.7;
const REGRADING_DRIFT_THRESHOLD_RATIO = 0.08;
const REGRADING_DRIFT_THRESHOLD_MIN = 8;
const GRADING_PASSES = 1;
const PASS_SPREAD_REVIEW_THRESHOLD_RATIO = 0.08;
const PASS_SPREAD_REVIEW_THRESHOLD_MIN = 8;
const GRADING_PROMPT_VERSION = "2026-04-24-v4";

const GradeSubmissionRequestSchema = z
  .object({
    submissionIds: z.array(z.string().uuid()).max(50).optional(),
    submissionId: z.string().uuid().optional(),
    assignmentId: z.string().uuid().optional(),
    force_regenerate: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.submissionId) || Boolean(value.submissionIds?.length), {
    message: "At least one of submissionId or submissionIds is required",
    path: ["submissionIds"],
  });

type EvidenceCoverage = {
  dataset_selected: boolean;
  cleaning_present: boolean;
  eda_present: boolean;
  two_methods_present: boolean;
  interpretation_present: boolean;
  visualisation_present: boolean;
  conclusion_present: boolean;
  coverage_count: number;
  methods_relevant: boolean;
};

type RelevanceClassification = "RELEVANT" | "PARTIALLY_RELEVANT" | "OFF_TOPIC";

type RelevanceAssessment = {
  classification: RelevanceClassification;
  reasons: string[];
};

type RubricCriterion = {
  criterion: string;
  weight: number;
  description?: string;
};

type GradeBreakdownItem = {
  criterion: string;
  score: number;
  max_score: number;
  performance_band: string;
  comment: string;
  evidence_snippet: string;
  rubric_expectation: string;
  evidence_from_submission: string;
  reason_for_score: string;
  improvement_feedback: string;
  strengths: string[];
  weaknesses: string[];
  confidence_score: number;
  review_required: boolean;
  error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
};

type MathAnalysis = {
  symbolic_extraction: string[];
  derivation_checks: Array<{
    step_label: string;
    status: "valid" | "unclear" | "invalid";
    rationale: string;
  }>;
  error_classification: "arithmetic_slip" | "conceptual_flaw" | "none";
  solver_signals: string[];
};

type ExistingGradeRecord = {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: unknown;
  grading_confidence?: number | null;
  grading_metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type CachedGradeResult = {
  score: number;
  feedback: string;
  breakdown: GradeBreakdownItem[];
  assignmentType: AssignmentType;
  gradingConfidence: number;
  requiresLecturerReview: boolean;
  reviewReasons: string[];
  gradingMetadata: Record<string, unknown>;
};

type FingerprintGradeCluster = {
  fingerprint: string;
  canonicalGrade: ExistingGradeRecord;
  gradeCount: number;
  scoreSpread: number;
};

type GradingCandidate = {
  gradeResult: Record<string, unknown>;
  normalized: ReturnType<typeof normalizeBreakdown>;
  modelScore: number | null;
  modelFeedback: string;
  scoreAdjusted: boolean;
  positiveFeedbackLowScoreMismatch: boolean;
};

type GradingHistoryEntry = {
  previous_score: number | null;
  new_score: number | null;
  previous_confidence: number | null;
  new_confidence: number | null;
  grading_input_hash: string;
  prompt_version: string;
  timestamp: string;
  reason_for_regrade: string;
};

function clampScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maxScore, Number(numeric.toFixed(2))));
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, Number(numeric.toFixed(2))));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildGradingInputHash(params: {
  submissionText: string;
  rubric: RubricCriterion[];
  assignmentInstructions: string;
  maxScore: number;
}) {
  return await sha256Hex(
    [
      params.submissionText,
      JSON.stringify(params.rubric),
      params.assignmentInstructions,
      String(params.maxScore),
      GRADING_PROMPT_VERSION,
    ].join("\n---\n"),
  );
}

function normalizeHistory(metadata: Record<string, unknown> | null | undefined) {
  if (!Array.isArray(metadata?.grading_history)) return [] as GradingHistoryEntry[];
  return metadata.grading_history
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      previous_score: item.previous_score == null ? null : Number(item.previous_score),
      new_score: item.new_score == null ? null : Number(item.new_score),
      previous_confidence: item.previous_confidence == null ? null : Number(item.previous_confidence),
      new_confidence: item.new_confidence == null ? null : Number(item.new_confidence),
      grading_input_hash: typeof item.grading_input_hash === "string" ? item.grading_input_hash : "",
      prompt_version: typeof item.prompt_version === "string" ? item.prompt_version : "",
      timestamp: typeof item.timestamp === "string" ? item.timestamp : "",
      reason_for_regrade: typeof item.reason_for_regrade === "string" ? item.reason_for_regrade : "",
    }))
    .filter((item) => item.grading_input_hash);
}

async function resolveActorRoles(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const [rolesRes, profileRes] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  if (rolesRes.error || profileRes.error) {
    throw new Error("Failed to resolve actor roles");
  }

  const roles = new Set<string>();
  for (const row of rolesRes.data || []) {
    if (typeof row.role === "string") roles.add(row.role);
  }
  if (typeof profileRes.data?.role === "string") roles.add(profileRes.data.role);
  return [...roles];
}

function normalizeFingerprintText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitNameTokens(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function blindSubmissionText({
  text,
  studentName,
  studentEmail,
  fileName,
}: {
  text: string;
  studentName?: string | null;
  studentEmail?: string | null;
  fileName?: string | null;
}) {
  let blinded = text;
  const exactRedactions = new Set<string>();

  for (const candidate of [studentName, studentEmail, fileName]) {
    if (candidate && candidate.trim()) {
      exactRedactions.add(candidate.trim());
    }
  }

  for (const token of splitNameTokens(studentName)) {
    exactRedactions.add(token);
  }
  for (const token of splitNameTokens(studentEmail)) {
    exactRedactions.add(token);
  }
  for (const token of splitNameTokens(fileName)) {
    exactRedactions.add(token);
  }

  for (const token of Array.from(exactRedactions).sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(escapeRegex(token), "gi");
    blinded = blinded.replace(pattern, "[REDACTED]");
  }

  const identityLinePatterns = [
    /^\s*(name|student name|candidate name|student|learner|submitted by)\s*:\s*.+$/gim,
    /^\s*(email|student email|candidate email)\s*:\s*.+$/gim,
    /^\s*(student id|candidate id|matric(?:ulation)? no|registration no|reg no)\s*:\s*.+$/gim,
  ];

  for (const pattern of identityLinePatterns) {
    blinded = blinded.replace(pattern, "[REDACTED IDENTITY LINE]");
  }

  return blinded
    .replace(/\[REDACTED\](\s+\[REDACTED\])+/g, "[REDACTED]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function computeContentFingerprint(assignmentId: string, text: string) {
  const normalized = normalizeFingerprintText(text);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${assignmentId}:${(hash >>> 0).toString(16)}:${normalized.length}`;
}

function hasMeaningfulScoreDrift(previousScore: number, nextScore: number, maxScore: number) {
  const threshold = Math.max(REGRADING_DRIFT_THRESHOLD_MIN, Math.round(maxScore * REGRADING_DRIFT_THRESHOLD_RATIO));
  return Math.abs(previousScore - nextScore) >= threshold;
}

function buildRegradeAnchorText(existingGrade: ExistingGradeRecord | null | undefined) {
  if (!existingGrade || existingGrade.ai_score == null) return "";

  const summary = {
    ai_score: existingGrade.ai_score,
    grading_confidence: existingGrade.grading_confidence ?? null,
    ai_feedback: existingGrade.ai_feedback ?? "",
    ai_breakdown: Array.isArray(existingGrade.ai_breakdown) ? existingGrade.ai_breakdown : [],
  };

  return `Existing stored AI grade for this submission (regrade anchor):
${JSON.stringify(summary)}

REGRADING CONSISTENCY RULES:
- The submission evidence has not changed, so do not materially change the score unless the prior grade clearly conflicts with the rubric evidence.
- Keep the new score within +/-5 marks of the prior score unless there is a clear rubric-based reason for a larger change.
- If you change the score by more than 5 marks, explain the reason explicitly in overall_feedback and set lecturer_review_required to true.`;
}

function buildGradingCandidate(
  gradeResult: Record<string, unknown>,
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

function getPassSpreadThreshold(maxScore: number) {
  return Math.max(PASS_SPREAD_REVIEW_THRESHOLD_MIN, Math.round(maxScore * PASS_SPREAD_REVIEW_THRESHOLD_RATIO));
}

function chooseCanonicalFingerprintGrade(grades: ExistingGradeRecord[]): FingerprintGradeCluster | null {
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

  const fingerprint = typeof canonical.grade.grading_metadata?.content_fingerprint === "string"
    ? canonical.grade.grading_metadata.content_fingerprint
    : "";

  return {
    fingerprint,
    canonicalGrade: canonical.grade,
    gradeCount: scoredGrades.length,
    scoreSpread: Math.max(...sortedScores) - Math.min(...sortedScores),
  };
}

function normalizeEvidence(value: unknown) {
  if (typeof value !== "string") return "No supporting quote extracted.";
  const text = value.trim();
  if (!text) return "No supporting quote extracted.";
  return text.slice(0, 280);
}

function normalizeComment(value: unknown) {
  if (typeof value !== "string") return "No criterion-specific comment provided.";
  const text = value.trim();
  return text || "No criterion-specific comment provided.";
}

function normalizeImprovementFeedback(value: unknown) {
  if (typeof value !== "string") return "No rubric-specific improvement guidance provided.";
  const text = value.trim();
  return text || "No rubric-specific improvement guidance provided.";
}

function normalizeStringList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items.slice(0, 6) : fallback;
}

function normalizePerformanceBand(value: unknown) {
  if (typeof value !== "string") return "Unspecified";
  const text = value.trim();
  return text || "Unspecified";
}

function normalizeErrorType(value: unknown): GradeBreakdownItem["error_type"] {
  return value === "arithmetic_slip" || value === "conceptual_flaw" || value === "none" ? value : "none";
}

function normalizeCriterionKey(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBreakdown(raw: unknown, rubric: RubricCriterion[]) {
  const provided = Array.isArray(raw) ? raw : [];
  const normalizedProvided = provided.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
  const byCriterion = new Map(
    normalizedProvided
      .map((item) => {
        const breakdown = item as Record<string, unknown>;
        const criterion = normalizeCriterionKey(breakdown.criterion_name ?? breakdown.criterion);
        return [criterion.toLowerCase(), breakdown] as const;
      }),
  );
  const fairnessNotes: string[] = [];
  let recalibrated = false;

  const breakdown: GradeBreakdownItem[] = rubric.map((criterion) => {
    const normalizedCriterion = normalizeCriterionKey(criterion.criterion);
    const matched =
      byCriterion.get(normalizedCriterion) ||
      (rubric.length === 1 && normalizedProvided.length === 1 ? normalizedProvided[0] : undefined);
    const maxScore = criterion.weight;
    const rawScoreValue = matched?.awarded_score ?? matched?.score;
    const rawScore = Number(rawScoreValue);
    const score = clampScore(rawScoreValue, maxScore);
    const rawMaxScore = Number(matched?.max_score);
    const confidence = clampConfidence(matched?.confidence_score);
    const reviewRequired =
      typeof matched?.review_required === "boolean"
        ? matched.review_required
        : typeof matched?.lecturer_review_required === "boolean"
          ? matched.lecturer_review_required
          : confidence < CONFIDENCE_THRESHOLD;

    if (Number.isFinite(rawScore) && Math.abs(rawScore - score) > 0.01) {
      recalibrated = true;
      fairnessNotes.push(`${criterion.criterion}: awarded_score was recalibrated to fit criterion max_score.`);
    }
    if (Number.isFinite(rawMaxScore) && rawMaxScore === 100 && maxScore !== 100) {
      recalibrated = true;
      fairnessNotes.push(`${criterion.criterion}: AI appeared to score this criterion out of 100 instead of ${maxScore}.`);
    }

    return {
      criterion: criterion.criterion,
      score,
      max_score: maxScore,
      performance_band: normalizePerformanceBand(matched?.performance_band),
      comment: normalizeComment(matched?.reason_for_score ?? matched?.comment),
      evidence_snippet: normalizeEvidence(
        Array.isArray(matched?.evidence_from_submission)
          ? normalizeStringList(matched?.evidence_from_submission).join("; ")
          : matched?.evidence_from_submission ?? matched?.evidence_snippet,
      ),
      rubric_expectation: normalizeComment(matched?.rubric_expectation ?? criterion.description ?? ""),
      evidence_from_submission: normalizeEvidence(
        Array.isArray(matched?.evidence_from_submission)
          ? normalizeStringList(matched?.evidence_from_submission).join("; ")
          : matched?.evidence_from_submission ?? matched?.evidence_snippet,
      ),
      reason_for_score: normalizeComment(matched?.reason_for_score ?? matched?.comment),
      improvement_feedback: normalizeImprovementFeedback(matched?.improvement_feedback),
      strengths: normalizeStringList(matched?.strengths),
      weaknesses: normalizeStringList(matched?.weaknesses),
      confidence_score: confidence,
      review_required: reviewRequired,
      error_type: normalizeErrorType(matched?.error_type),
    };
  });

  const total = Number(breakdown.reduce((sum, item) => sum + item.score, 0).toFixed(2));
  const averageConfidence =
    breakdown.length > 0
      ? Number(
          (
            breakdown.reduce((sum, item) => sum + item.confidence_score * item.max_score, 0) /
            Math.max(1, breakdown.reduce((sum, item) => sum + item.max_score, 0))
          ).toFixed(3),
        )
      : 0;

  const reviewReasons = breakdown
    .filter((item) => item.review_required)
    .map((item) => `${item.criterion} confidence ${item.confidence_score}`);

  return { breakdown, total, averageConfidence, reviewReasons, fairnessNotes, recalibrated };
}

function normalizeMathAnalysis(raw: unknown): MathAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const derivationChecks = Array.isArray(candidate.derivation_checks)
    ? candidate.derivation_checks
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const status = entry.status === "valid" || entry.status === "unclear" || entry.status === "invalid"
            ? entry.status
            : "unclear";
          return {
            step_label: typeof entry.step_label === "string" ? entry.step_label.trim() || "Step" : "Step",
            status,
            rationale: typeof entry.rationale === "string" ? entry.rationale.trim() : "",
          };
        })
    : [];

  const symbolicExtraction = Array.isArray(candidate.symbolic_extraction)
    ? candidate.symbolic_extraction.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];

  const solverSignals = Array.isArray(candidate.solver_signals)
    ? candidate.solver_signals.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];

  return {
    symbolic_extraction: symbolicExtraction,
    derivation_checks: derivationChecks,
    error_classification:
      candidate.error_classification === "arithmetic_slip" ||
      candidate.error_classification === "conceptual_flaw" ||
      candidate.error_classification === "none"
        ? candidate.error_classification
        : "none",
    solver_signals: solverSignals,
  };
}

function normalizeOverallScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampScore(numeric, maxScore);
}

function detectPositiveFeedbackLowScoreMismatch(feedback: string, score: number, maxScore: number) {
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

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.filter((pattern) => pattern.test(text)).length;
}

function detectEvidenceCoverage({
  submissionText,
  feedback,
  reasonForScore,
  evidenceText,
}: {
  submissionText: string;
  feedback: string;
  reasonForScore: string;
  evidenceText: string;
}): EvidenceCoverage {
  const combined = `${submissionText}\n${feedback}\n${reasonForScore}\n${evidenceText}`.toLowerCase();
  const methodPatterns = [
    /\bregression\b/,
    /\blinear regression\b/,
    /\blogistic regression\b/,
    /\bclustering\b/,
    /\bk-?means\b/,
    /\bclassification\b/,
    /\bdecision tree\b/,
    /\brandom forest\b/,
    /\banova\b/,
    /\bcorrelation\b/,
    /\bforecast(?:ing)?\b/,
    /\btime series\b/,
    /\bpca\b/,
    /\bprincipal component analysis\b/,
    /\bhypothesis test(?:ing)?\b/,
    /\bchi-?square\b/,
  ];
  const matchedMethods = methodPatterns.filter((pattern) => pattern.test(combined)).length;

  const coverage = {
    dataset_selected: includesAny(combined, [
      /\bdataset\b/,
      /\bdata set\b/,
      /\bselected data\b/,
      /\bchosen data\b/,
      /\bsource data\b/,
    ]),
    cleaning_present: includesAny(combined, [
      /\bclean(?:ing|ed)?\b/,
      /\bpreprocessing\b/,
      /\bpre-?process(?:ing|ed)?\b/,
      /\bmissing values?\b/,
      /\boutlier(?:s)?\b/,
      /\bnormalis(?:e|ed|ation)\b/,
      /\bstandardis(?:e|ed|ation)\b/,
    ]),
    eda_present: includesAny(combined, [
      /\beda\b/,
      /\bexploratory analysis\b/,
      /\bexploratory data analysis\b/,
      /\bdescriptive statistics?\b/,
      /\bsummary statistics?\b/,
      /\bdistribution\b/,
    ]),
    two_methods_present:
      matchedMethods >= 2 ||
      includesAny(combined, [
        /\btwo analytical techniques\b/,
        /\btwo analytical techniques attempted\b/,
        /\bsecond analytical technique\b/,
        /\bmultiple analytical techniques\b/,
      ]),
    interpretation_present: includesAny(combined, [
      /\binterpret(?:ation|ed|s)?\b/,
      /\breasonable interpretation\b/,
      /\bfindings suggest\b/,
      /\bresults indicate\b/,
      /\bthis shows\b/,
      /\bexplains the results\b/,
    ]),
    visualisation_present: includesAny(combined, [
      /\bvisuali[sz]ation\b/,
      /\bplot(?:s)?\b/,
      /\bchart(?:s)?\b/,
      /\bgraph(?:s)?\b/,
      /\bfigure(?:s)?\b/,
      /\bhistogram\b/,
      /\bscatter\b/,
      /\bbox plot\b/,
    ]),
    conclusion_present: includesAny(combined, [
      /\bconclusion\b/,
      /\blimitation(?:s)?\b/,
      /\bsummary\b/,
      /\bconclude(?:d|s)?\b/,
      /\brecommendation(?:s)?\b/,
      /\bfinal remarks?\b/,
    ]),
    coverage_count: 0,
    methods_relevant:
      matchedMethods >= 1 ||
      includesAny(combined, [/\brelevant methods?\b/, /\bappropriate methods?\b/, /\bcorrect methods?\b/]),
  };

  coverage.coverage_count = [
    coverage.dataset_selected,
    coverage.cleaning_present,
    coverage.eda_present,
    coverage.two_methods_present,
    coverage.interpretation_present,
    coverage.visualisation_present,
    coverage.conclusion_present,
  ].filter(Boolean).length;

  return coverage;
}

function deriveUkBand(score: number, maxScore: number) {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (percent >= 70) return "First class / distinction";
  if (percent >= 60) return "Upper second / merit";
  if (percent >= 50) return "Lower second / satisfactory";
  if (percent >= 40) return "Third / basic pass";
  if (percent >= 30) return "Fail";
  return "Clear fail";
}

function redistributeBreakdownToTotal(breakdown: GradeBreakdownItem[], targetTotal: number) {
  if (breakdown.length === 0) return breakdown;

  let remaining = Math.max(0, Number(targetTotal.toFixed(2)));

  return breakdown.map((item, index) => {
    const nextScore = index === 0 ? Math.min(item.max_score, remaining) : 0;
    remaining = Math.max(0, remaining - nextScore);
    return {
      ...item,
      score: nextScore,
      review_required: true,
    };
  });
}

function extractKeywordSet(text: string) {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "about", "your", "their", "have", "has", "had",
    "were", "was", "are", "is", "be", "been", "being", "will", "shall", "would", "could", "should", "can", "may",
    "might", "must", "than", "then", "them", "they", "you", "our", "out", "but", "not", "all", "any", "each",
    "using", "use", "used", "within", "which", "what", "when", "where", "while", "into", "onto", "upon", "also",
    "only", "main", "core", "work", "task", "assignment", "brief", "report", "submission", "criterion", "criteria",
    "student", "students", "required", "requirements",
  ]);

  return new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9_-]{2,}/g)?.filter((token) => !stopWords.has(token)) ?? [],
  );
}

function assessSubmissionRelevance({
  assignmentTitle,
  assignmentInstructions,
  rubric,
  submissionText,
  feedback,
  criterionReasons,
}: {
  assignmentTitle: string;
  assignmentInstructions: string;
  rubric: RubricCriterion[];
  submissionText: string;
  feedback: string;
  criterionReasons: string[];
}): RelevanceAssessment {
  const combinedEvaluatorText = `${feedback}\n${criterionReasons.join("\n")}`.toLowerCase();
  const redFlagPatterns = [
    /off-topic/,
    /does not address the required task/,
    /no relevant evidence/,
    /cannot be credited against this assignment/,
    /unrelated to the assignment brief/,
    /wrong subject/,
    /wrong task/,
  ];

  const matchedRedFlags = redFlagPatterns.filter((pattern) => pattern.test(combinedEvaluatorText));
  if (matchedRedFlags.length > 0) {
    const explicitWrongTask = matchedRedFlags.some((pattern) =>
      /off-topic|wrong task|wrong subject|unrelated to the assignment brief|cannot be credited against this assignment/.test(
        pattern.source,
      )
    );
    return {
      classification: explicitWrongTask ? "OFF_TOPIC" : "PARTIALLY_RELEVANT",
      reasons: ["Evaluator feedback indicates the submission does not answer the assignment brief."],
    };
  }

  const assignmentKeywords = extractKeywordSet(
    `${assignmentTitle}\n${assignmentInstructions}\n${rubric.map((item) => `${item.criterion} ${item.description ?? ""}`).join("\n")}`,
  );
  const submissionKeywords = extractKeywordSet(submissionText);
  const overlapCount = Array.from(assignmentKeywords).filter((keyword) => submissionKeywords.has(keyword)).length;

  const rubricCriteriaMatched = rubric.filter((criterion) => {
    const criterionKeywords = extractKeywordSet(`${criterion.criterion} ${criterion.description ?? ""}`);
    const criterionOverlap = Array.from(criterionKeywords).filter((keyword) => submissionKeywords.has(keyword)).length;
    return criterionOverlap > 0;
  }).length;

  const relevantSignals = [
    "relevant",
    "addresses the task",
    "addresses the brief",
    "meets requirements",
    "maps to the rubric",
    "clear evidence",
    "reasonable interpretation",
  ].filter((signal) => combinedEvaluatorText.includes(signal)).length;

  const briefSpecificityHigh = assignmentKeywords.size >= 6;

  if (overlapCount === 0 && rubricCriteriaMatched === 0 && relevantSignals === 0) {
    return {
      classification: "OFF_TOPIC",
      reasons: ["Submission text does not align with assignment or rubric keywords."],
    };
  }

  if (
    rubricCriteriaMatched === 0 ||
    (briefSpecificityHigh && overlapCount <= 1) ||
    (overlapCount <= 2 && relevantSignals === 0)
  ) {
    return {
      classification: "PARTIALLY_RELEVANT",
      reasons: ["Submission touches the broad area but does not map clearly to the required task."],
    };
  }

  return {
    classification: "RELEVANT",
    reasons: ["Submission content aligns with the assignment brief and rubric."],
  };
}

function buildRubricCalibrationGuide(rubric: RubricCriterion[], maxScore: number) {
  const criterionLines = rubric.map((criterion, index) =>
    `${index + 1}. ${criterion.criterion} (${criterion.weight}/${maxScore})` +
    `${criterion.description ? ` -> ${criterion.description}` : ""}`
  );

  return `RUBRIC-FIRST CALIBRATION GUIDE:
- Use the rubric wording as the primary basis for marking. Do not introduce hidden expectations.
- Award marks because the submission satisfies the stated rubric criterion, not because it resembles an ideal answer.
- If the rubric is broad, mark according to the quality of the evidence actually shown.
- Do not collapse competent work into the 40s just because it lacks distinction-level depth.
- If work meets the main requirements of a broad criterion, it will normally sit in the 50s.
- If work meets all core requirements with correct methods and reasonable interpretation, it will normally sit in the 60s.
- 70+ requires strong depth, strong evidence, and clear analytical insight.
- If unsure between two adjacent bands, lower confidence and recommend lecturer review rather than forcing the lower band.

Criterion guide:
${criterionLines.join("\n")}`;
}

function isNearGradeBoundary(score: number, maxScore: number) {
  const boundaries = [40, 50, 60, 70];
  return boundaries.some((boundaryPercent) => {
    const boundaryMark = (maxScore * boundaryPercent) / 100;
    return Math.abs(score - boundaryMark) <= 3;
  });
}

function resolveSingleCriterionFairnessRecalibration({
  feedback,
  reasonForScore,
  awardedScore,
  evidenceText,
  submissionText,
  maxScore,
  extractionSuccess,
  extractedTextLength,
  integrityRiskHigh,
}: {
  feedback: string;
  reasonForScore: string;
  awardedScore: number;
  evidenceText: string;
  submissionText: string;
  maxScore: number;
  extractionSuccess: boolean;
  extractedTextLength: number;
  integrityRiskHigh: boolean;
}) {
  const combined = `${feedback} ${reasonForScore}`.toLowerCase();
  const evidence = evidenceText.toLowerCase().trim();
  const evidenceCoverage = detectEvidenceCoverage({
    submissionText,
    feedback,
    reasonForScore,
    evidenceText,
  });

  if (!extractionSuccess || extractedTextLength <= 0) return null;
  if (!evidence || evidence === "no supporting quote extracted.") return null;
  if (integrityRiskHigh) return null;

  const disqualifiers = [
    "little or no relevant evidence",
    "no relevant evidence",
    "off-topic",
    "blank submission",
    "unreadable",
    "gibberish",
    "fails to meet",
  ];
  if (disqualifiers.some((signal) => combined.includes(signal))) return null;

  const excellentSignals = [
    "excellent",
    "critical analysis",
    "strong evidence",
    "clear analytical insight",
    "insightful",
    "well-developed analysis",
  ];
  const goodBandSignals = [
    "good",
    "solid",
    "strong",
    "solid report",
    "good standard",
    "solid/good",
    "good depth",
    "clear analytical insight",
  ];
  const satisfactorySignals = [
    "competent",
    "coherent",
    "relevant",
    "relevant and coherent",
    "clear topic",
    "sensible preprocessing",
    "appropriate exploratory analysis",
    "addresses the main requirements",
    "meets core requirements",
    "meets the core requirements",
    "meets all core requirements",
    "meets requirements",
    "clear evidence",
    "addresses task",
    "addresses the task",
    "reasonable interpretation",
    "clear",
    "two analytical techniques",
    "two analytical techniques attempted",
    "logical interpretation",
  ];
  const methodsAndCoverageSignals = [
    /\bpreprocessing\b/,
    /\bexploratory analysis\b/,
    /\bexploratory data analysis\b/,
    /\btwo analytical techniques(?: attempted)?\b/,
    /\breasonable interpretation\b/,
    /\bvisuali[sz]ation\b/,
    /\bconclusion\b/,
    /\blimitations?\b/,
  ];
  const positiveRubricSignals = [
    /\bcompetent\b/,
    /\bcoherent\b/,
    /\brelevant\b/,
    /\bclear topic\b/,
    /\bmeets (?:the )?main requirements\b/,
    /\bmeets (?:all )?core requirements\b/,
    /\bappropriate exploratory analysis\b/,
    /\bsensible preprocessing\b/,
    /\btwo analytical techniques(?: attempted)?\b/,
    /\breasonable interpretation\b/,
  ];

  const hasExcellentSignals = excellentSignals.some((signal) => combined.includes(signal));
  const hasGoodSignals = goodBandSignals.some((signal) => combined.includes(signal));
  const hasSatisfactorySignals = satisfactorySignals.some((signal) => combined.includes(signal));
  const positiveSignalCount = countMatches(combined, positiveRubricSignals);
  const methodsSignalCount = countMatches(combined, methodsAndCoverageSignals);

  let targetScore: number | null = null;
  let performanceBand = "Satisfactory";
  let note =
    "Score recalibrated using UK university marking bands because the submission met the main assignment requirements and the original score was below the expected band.";

  if (
    evidenceCoverage.coverage_count >= 7 &&
    evidenceCoverage.two_methods_present &&
    evidenceCoverage.interpretation_present &&
    evidenceCoverage.methods_relevant
  ) {
    if (hasExcellentSignals) {
      targetScore = 76;
      performanceBand = "Excellent";
      note =
        "Score recalibrated using UK university marking bands because the submission covered all required components with strong analysis and evidence.";
    } else if (hasGoodSignals) {
      targetScore = 70;
      performanceBand = "Good";
      note =
        "Score recalibrated to the Good band because the submission showed good depth, relevant methods, and clear analytical insight.";
    } else {
      targetScore = 64;
      performanceBand = "Good";
      note =
        "Score recalibrated to the upper-second band because the submission covered all core requirements with reasonable methods and interpretation.";
    }
  } else if (evidenceCoverage.coverage_count >= 6 && evidenceCoverage.interpretation_present) {
    targetScore = hasGoodSignals ? 68 : 60;
    performanceBand = "Good";
    note =
      "Score recalibrated using UK university marking bands because the submission met the main requirements with reasonable methods and interpretation.";
  } else if (evidenceCoverage.coverage_count >= 5) {
    targetScore = hasGoodSignals ? 62 : 55;
    performanceBand = "Satisfactory";
    note =
      "Score recalibrated to Satisfactory band because feedback indicates the work meets core requirements.";
  } else if (awardedScore < 40 && methodsSignalCount >= 3) {
    targetScore = hasGoodSignals || evidenceCoverage.interpretation_present ? 60 : 55;
    performanceBand = targetScore >= 60 ? "Good" : "Satisfactory";
    note =
      "Score recalibrated using UK university marking bands because the feedback described clear preprocessing, exploratory analysis, and multiple analytical techniques.";
  } else if (awardedScore < 40 && hasGoodSignals) {
    return {
      score: Math.min(maxScore, 65),
      performanceBand: "Good",
      ukBand: deriveUkBand(Math.min(maxScore, 65), maxScore),
      evidenceCoverage,
      note:
        "Score recalibrated to the Good band because feedback indicates the work is good/solid/strong, even though the original mark was too low.",
    };
  }

  if (targetScore == null && awardedScore < 40 && hasSatisfactorySignals) {
    targetScore = 55;
    performanceBand = "Satisfactory";
    note =
      "Score recalibrated to Satisfactory band because feedback indicates the work meets core requirements.";
  }

  if (targetScore == null && awardedScore < 40 && positiveSignalCount >= 2) {
    targetScore = methodsSignalCount >= 3 ? 60 : 55;
    performanceBand = targetScore >= 60 ? "Good" : "Satisfactory";
    note =
      targetScore >= 60
        ? "Score recalibrated to the upper-second band because the feedback describes competent work with relevant analytical methods."
        : "Score recalibrated to Satisfactory band because the feedback describes competent, relevant work that meets the task.";
  }

  if (targetScore == null || awardedScore >= targetScore) return null;

  return {
    score: Math.min(maxScore, targetScore),
    performanceBand,
    ukBand: deriveUkBand(Math.min(maxScore, targetScore), maxScore),
    evidenceCoverage,
    note,
  };
}

async function requestStructuredGrade({
  gradingModel,
  systemPrompt,
  prompt,
  rubricLength,
  isMathMode,
}: {
  gradingModel: string;
  systemPrompt: string;
  prompt: string;
  rubricLength: number;
  isMathMode: boolean;
}) {
  const aiData = await createResponse({
    model: gradingModel,
    temperature: 0,
    top_p: 1,
    input: [
      { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: prompt }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "submit_grade",
        schema: buildResponseSchema(rubricLength, isMathMode),
        strict: true,
      },
    },
  });

  try {
    return parseJsonText(extractOutputText(aiData)) as Record<string, unknown>;
  } catch {
    return (aiData?.output?.[0]?.content?.[0]?.json ?? aiData?.output_parsed ?? null) as Record<string, unknown> | null;
  }
}

async function fetchSubmissionContent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sub: { file_url: string; file_name: string | null },
) {
  const { data: fileData, error: dlError } = await supabaseAdmin.storage
    .from("submissions")
    .download(sub.file_url);

  if (dlError || !fileData) {
    throw new Error("Failed to download file");
  }

  const extraction = await extractSubmissionDocument({
    fileName: sub.file_name,
    mimeType: fileData.type,
    fileData,
  });

  logDocumentExtractionResult("grade-submission", extraction);

  if (!extraction.success) {
    throw new Error(extraction.extractionError || DOCUMENT_EXTRACTION_ERROR_MESSAGE);
  }

  return {
    extractedText: extraction.extractedText,
    extractionMetadata: {
      file_name: extraction.fileName,
      file_type: extraction.fileType,
      mime_type: extraction.mimeType,
      extracted_text_length: extraction.extractedTextLength,
      extraction_success: extraction.success,
      extraction_warning: extraction.extractionWarning,
      extraction_error: extraction.extractionError,
    },
  };
}

function buildSystemPrompt(assignmentType: AssignmentType, rubricLength: number, maxScore: number) {
  const baseRules = `You are an academic marking assistant for higher education.

Your role is to apply the rubric exactly and produce fair, consistent, evidence-based marks.

You are NOT a strict examiner and NOT a generous tutor.
You are a fair, rubric-faithful marker.

CORE RULE:
The rubric defines what good work is. You must not introduce hidden criteria.

MARKING PROCESS (MANDATORY):

For EACH rubric criterion:

1. Read the criterion and its max_score.
2. Identify specific evidence from the submission relevant to that criterion.
3. If no relevant evidence is found, state that clearly.
4. Choose a performance band based ONLY on the evidence.
5. Assign a score within that criterion's max_score.
6. Explain the reason for the score using the evidence.
7. Assign a confidence score using the calibration table below.

PERFORMANCE BANDS:
Percentages refer to the proportion of the criterion's own max_score.

- Excellent (85–100%): strong, clear, well-developed evidence fully meeting the criterion
- Good (70–84%): clear evidence with minor gaps or limited depth
- Satisfactory (55–69%): meets basic requirement but lacks depth or consistency
- Basic (40–54%): some relevant evidence but weak or incomplete
- Weak (20–39%): very limited relevant evidence
- No evidence (0–19%): little or no relevant evidence

EMPTY OR OFF-TOPIC SUBMISSIONS:
If a criterion has no addressable submission content, meaning blank, gibberish, unreadable, or entirely off-topic, set awarded_score to 0, performance_band to "No evidence", and explain clearly in reason_for_score.

CALIBRATION OVERRIDES:

- Treat lack of depth alone as a Satisfactory-level limitation, not a Basic-level failure.
- If work meets all core requirements, applies required techniques correctly, and provides a logical interpretation, default to at least the Satisfactory band.
- Reserve the Basic band for cases where multiple required elements are weak or missing, or understanding is clearly limited.

FAIRNESS RULES (CRITICAL):

- If the student clearly addresses the criterion, DO NOT assign a near-zero or fail score.
- If the student meets core requirements, the score must not fall below the Basic or Satisfactory band.
- If the student meets all core requirements, applies required techniques correctly, and provides a logical interpretation, the score must not fall below the Satisfactory band.
- Lack of depth alone should reduce a Good score to Satisfactory, not to Basic.
- Use partial credit fairly when there is some correct or relevant work.
- Do NOT over-penalise grammar, structure, or formatting unless the rubric explicitly assesses writing quality.
- Do NOT reward fluent writing if required analysis or evidence is weak.
- Do NOT assume work that is not shown.
- Do NOT invent evidence.

CONSISTENCY RULES:

- Feedback must match the score.
- If feedback is positive, for example "clear", "relevant", or "meets requirement", the score must not be in the fail range.
- If score is below 40%, you must clearly explain why the work fails to meet the criterion.
- If unsure, reduce confidence instead of reducing score.

SCORING RULES:

- Score each criterion out of its own max_score, not out of 100 unless that criterion's max_score is 100.
- Final score must equal the exact sum of all criterion awarded_scores.
- Do NOT apply hidden scaling or normalisation.

CONFIDENCE CALIBRATION:
Assign a confidence_score to each criterion and to the overall result using these anchors:

- 0.90 or above: criterion is unambiguous, evidence is clear, and evidence maps directly to a band
- 0.70 to 0.89: minor interpretation required, but score is well-supported
- 0.50 to 0.69: criterion is vague, evidence is partial, or submission is ambiguous. Reduce score only if clearly justified by evidence
- Below 0.50: serious uncertainty. Flag for lecturer review

LECTURER REVIEW TRIGGERS:
Set lecturer_review_required to true if ANY of the following apply:

- Overall confidence_score is below 0.65
- Total score falls within 3 marks of a grade boundary
- Any single criterion confidence_score is below 0.50
- The submission raises academic integrity concerns, such as inconsistent voice, implausible sophistication, or suspected AI generation
- Score-feedback mismatch is detected
- Any criterion score had to be recalibrated

OUTPUT FORMAT (STRICT):

Return JSON only. No preamble, no explanation outside the JSON.

{
  "criteria": [
    {
      "criterion_name": "...",
      "max_score": 20,
      "awarded_score": 14,
      "performance_band": "Good",
      "evidence_from_submission": ["..."],
      "reason_for_score": "...",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "improvement_feedback": "...",
      "confidence_score": 0.82
    }
  ],
  "total_score": 72,
  "overall_feedback": "...",
  "main_strengths": ["..."],
  "main_weaknesses": ["..."],
  "confidence_score": 0.80,
  "lecturer_review_required": false
}

FINAL CHECK (MANDATORY BEFORE OUTPUT):

- Does each score reflect the band percentages applied to that criterion's max_score?
- Does feedback tone match the score?
- Are any scores unfairly low given the evidence?
- Does total_score equal the exact sum of all awarded_scores?
- Do any lecturer review triggers apply? If yes, set lecturer_review_required to true.
- If any inconsistency is found, correct it before returning.

Return exactly ${rubricLength} criterion rows in the same order as the rubric.
The evidence_from_submission must quote or closely excerpt the student's submission, not the rubric.
If the rubric wording is vague, apply a reasonable academic interpretation, lower confidence, and recommend lecturer review.
Be neither harsh nor generous. Be rubric-faithful.
Output valid JSON only.`;

  if (assignmentType === "Mathematics" || assignmentType === "Problem Solving") {
    return `${baseRules}

You are in MATHEMATICS / LOGIC-CHECKER mode.

Maths-specific rules:
- Prioritise symbolic correctness, derivation validity, and whether each step follows from the previous one.
- Distinguish arithmetic slips from conceptual flaws.
- Apply carry-forward credit for arithmetic slips when later reasoning remains coherent.
- Flag solver-like behaviour when there are impossible leaps, notation mismatches, or correct final answers without adequate working.
- Include a math_analysis object with:
  - symbolic_extraction: array of key expressions or equations you identified
  - derivation_checks: array of step checks with step_label, status, rationale
  - error_classification: arithmetic_slip | conceptual_flaw | none
  - solver_signals: array of suspicious solver-signature observations
- For each criterion, set error_type to arithmetic_slip, conceptual_flaw, or none.
- Do not judge mathematical work mainly by prose style.
- Final score is out of ${maxScore}.`;
  }

  const specialization =
    assignmentType === "Code"
      ? "Focus on correctness, completeness, structure, and whether the code or explanation matches the requirement."
      : assignmentType === "Reflective"
        ? "Focus on authentic reflection, specificity, self-awareness, and application of learning."
        : assignmentType === "Report"
          ? "Focus on structure, evidence, analysis, and professional communication."
          : "Focus on argument quality, evidence, relevance, and conceptual understanding.";

  return `${baseRules}

You are in ${assignmentType.toUpperCase()} mode.
${specialization}
- Final score is out of ${maxScore}.`;
}

function buildResponseSchema(rubricLength: number, includeMathAnalysis: boolean) {
  const schema: Record<string, unknown> = {
    type: "object",
    properties: {
      assignment_type: { type: "string" },
      total_score: { type: "number" },
      overall_feedback: { type: "string" },
      main_strengths: { type: "array", items: { type: "string" } },
      main_weaknesses: { type: "array", items: { type: "string" } },
      confidence_score: { type: "number" },
      lecturer_review_required: { type: "boolean" },
      criteria: {
        type: "array",
        minItems: rubricLength,
        maxItems: rubricLength,
        items: {
          type: "object",
          properties: {
            criterion_name: { type: "string" },
            awarded_score: { type: "number" },
            max_score: { type: "number" },
            performance_band: { type: "string" },
            evidence_from_submission: { type: "array", items: { type: "string" } },
            reason_for_score: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            improvement_feedback: { type: "string" },
            confidence_score: { type: "number" },
            error_type: {
              type: "string",
              enum: ["arithmetic_slip", "conceptual_flaw", "none"],
            },
          },
          required: [
            "criterion_name",
            "awarded_score",
            "max_score",
            "performance_band",
            "evidence_from_submission",
            "reason_for_score",
            "strengths",
            "weaknesses",
            "improvement_feedback",
            "confidence_score",
            "error_type",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "assignment_type",
      "total_score",
      "overall_feedback",
      "main_strengths",
      "main_weaknesses",
      "confidence_score",
      "lecturer_review_required",
      "criteria",
    ],
    additionalProperties: false,
  };

  if (includeMathAnalysis) {
    (schema.properties as Record<string, unknown>).math_analysis = {
      type: "object",
      properties: {
        symbolic_extraction: { type: "array", items: { type: "string" } },
        derivation_checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step_label: { type: "string" },
              status: { type: "string", enum: ["valid", "unclear", "invalid"] },
              rationale: { type: "string" },
            },
            required: ["step_label", "status", "rationale"],
            additionalProperties: false,
          },
        },
        error_classification: {
          type: "string",
          enum: ["arithmetic_slip", "conceptual_flaw", "none"],
        },
        solver_signals: { type: "array", items: { type: "string" } },
      },
      required: ["symbolic_extraction", "derivation_checks", "error_classification", "solver_signals"],
      additionalProperties: false,
    };
    (schema.required as string[]).push("math_analysis");
  }

  return schema;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user } = await requireLecturer(req);
    const rateLimit = applyRateLimit(req, {
      scope: "grade-submission",
      limit: 5,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      console.warn("Rate limit exceeded", { function: "grade-submission", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }

    const body = await req.json().catch(() => null);
    const rawBody = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const normalizedSubmissionIds = Array.isArray(rawBody?.submissionIds)
      ? rawBody.submissionIds.filter((item): item is string => typeof item === "string")
      : Array.isArray(rawBody?.submissions)
        ? rawBody.submissions
            .map((submission) =>
              typeof submission === "string"
                ? submission
                : submission && typeof submission === "object" && typeof (submission as Record<string, unknown>).id === "string"
                  ? (submission as Record<string, unknown>).id as string
                  : null
            )
            .filter((item): item is string => Boolean(item))
        : undefined;
    const parsedRequest = GradeSubmissionRequestSchema.safeParse({
      submissionIds: normalizedSubmissionIds,
      submissionId: typeof rawBody?.submissionId === "string" ? rawBody.submissionId : undefined,
      assignmentId:
        typeof rawBody?.assignmentId === "string"
          ? rawBody.assignmentId
          : rawBody?.assignment && typeof rawBody.assignment === "object" && typeof (rawBody.assignment as Record<string, unknown>).id === "string"
            ? (rawBody.assignment as Record<string, unknown>).id
            : undefined,
      force_regenerate: typeof rawBody?.force_regenerate === "boolean" ? rawBody.force_regenerate : undefined,
    });

    if (!parsedRequest.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parsedRequest.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { assignmentId, submissionId, submissionIds, force_regenerate } = parsedRequest.data;
    const gradingModel = getModel("OPENAI_GRADING_MODEL", "gpt-5.4-mini");
    const forceRegenerate = force_regenerate ?? false;
    const regradeReason =
      typeof rawBody?.regrade_reason === "string" && rawBody.regrade_reason.trim()
        ? rawBody.regrade_reason.trim()
        : forceRegenerate
          ? "Forced re-grade requested."
          : "Grading input changed.";

    const requestedAssignmentId = assignmentId ?? null;
    const requestedSubmissionIds = submissionIds ?? (submissionId ? [submissionId] : []);

    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      throw new HttpError(400, "Missing assignment or submissions data");
    }

    const supabaseAdmin = createAdminClient();
    const actorRoles = await resolveActorRoles(supabaseAdmin, user.id);
    const actorIsAdmin = actorRoles.includes("admin");
    if (forceRegenerate && !actorIsAdmin) {
      throw new HttpError(403, "Only admins can force AI re-grading");
    }
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, lecturer_id, title, description, module_code, max_score, rubric")
      .eq("id", requestedAssignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error("Failed to load assignment");
    if (!assignment || assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, student_name, student_email, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) throw new Error("Failed to load submissions");
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }

    const { data: assignmentSubmissionRows, error: assignmentSubmissionIdsError } = await supabaseAdmin
      .from("submissions")
      .select("id, file_url, file_name, student_name, student_email")
      .eq("assignment_id", requestedAssignmentId);

    if (assignmentSubmissionIdsError) throw new Error("Failed to load assignment submissions");
    const assignmentSubmissionIds = (assignmentSubmissionRows || []).map((row) => row.id).filter(Boolean);
    const assignmentSubmissionsById = new Map((assignmentSubmissionRows || []).map((row) => [row.id, row]));

    const { data: existingGradesData, error: existingGradesError } = await supabaseAdmin
      .from("grades")
      .select("id, submission_id, ai_score, ai_feedback, ai_breakdown, grading_confidence, grading_metadata, created_at")
      .in("submission_id", assignmentSubmissionIds.length > 0 ? assignmentSubmissionIds : requestedSubmissionIds);

    if (existingGradesError) throw new Error("Failed to load existing grades");
    const existingGradeRows = (existingGradesData || []) as ExistingGradeRecord[];
    const existingGradesBySubmission = new Map(existingGradeRows.map((grade) => [grade.submission_id, grade]));
    const gradesByFingerprint = new Map<string, ExistingGradeRecord[]>();
    for (const grade of existingGradeRows) {
      const fingerprint = typeof grade.grading_metadata?.content_fingerprint === "string"
        ? grade.grading_metadata.content_fingerprint
        : "";
      if (fingerprint) {
        const current = gradesByFingerprint.get(fingerprint) || [];
        current.push(grade);
        gradesByFingerprint.set(fingerprint, current);
      }
    }
    const gradesMissingFingerprint = existingGradeRows.filter((grade) => {
      const fingerprint = typeof grade.grading_metadata?.content_fingerprint === "string"
        ? grade.grading_metadata.content_fingerprint
        : "";
      return !fingerprint;
    });
    for (const grade of gradesMissingFingerprint) {
      const submission = assignmentSubmissionsById.get(grade.submission_id);
      if (!submission?.file_url) continue;
      try {
        const { extractedText } = await fetchSubmissionContent(supabaseAdmin, {
          file_url: submission.file_url,
          file_name: submission.file_name ?? null,
        });
        const blindedText = blindSubmissionText({
          text: extractedText,
          studentName: submission.student_name,
          studentEmail: submission.student_email,
          fileName: submission.file_name,
        });
        const fingerprint = computeContentFingerprint(assignment.id, blindedText);
        const gradingInputHash = await buildGradingInputHash({
          submissionText: blindedText,
          rubric: normalizedRubric,
          assignmentInstructions: `${assignment.title}\n${assignment.description || ""}`,
          maxScore: assignment.max_score,
        });
        const current = gradesByFingerprint.get(fingerprint) || [];
        current.push({
          ...grade,
          grading_metadata: {
            ...(grade.grading_metadata || {}),
            content_fingerprint: fingerprint,
            grading_input_hash: gradingInputHash,
            grading_prompt_version: GRADING_PROMPT_VERSION,
            blind_grading_applied: true,
          },
        });
        gradesByFingerprint.set(fingerprint, current);
      } catch {
        // Skip backfill for unreadable historical submissions; they will fall back to fresh grading.
      }
    }
    const existingGradesByFingerprint = new Map<string, FingerprintGradeCluster>();
    for (const [fingerprint, grades] of gradesByFingerprint.entries()) {
      const cluster = chooseCanonicalFingerprintGrade(
        grades.map((grade) => ({
          ...grade,
          grading_metadata: {
            ...(grade.grading_metadata || {}),
            content_fingerprint: fingerprint,
          },
        })),
      );
      if (cluster) {
        existingGradesByFingerprint.set(fingerprint, cluster);
      }
    }

    const rubric = Array.isArray(assignment.rubric) ? (assignment.rubric as RubricCriterion[]) : [];
    const normalizedRubric: RubricCriterion[] =
      rubric.length > 0
        ? rubric.map((criterion, index) => ({
            criterion: criterion.criterion || `Criterion ${index + 1}`,
            weight: Number(criterion.weight) || 0,
            description: criterion.description || "",
          }))
        : [
            {
              criterion: "Overall quality",
              weight: assignment.max_score,
              description: "Holistic quality, correctness, and completeness.",
            },
          ];

    const rubricText = normalizedRubric
      .map((criterion) => `- ${criterion.criterion} (${criterion.weight} pts): ${criterion.description || ""}`)
      .join("\n");

    const results: Array<Record<string, unknown>> = [];
    const generatedResultsByFingerprint = new Map<string, CachedGradeResult>();

    for (const sub of submissions) {
      try {
        const existingGrade = existingGradesBySubmission.get(sub.id) ?? null;
        const { extractedText, extractionMetadata } = await fetchSubmissionContent(supabaseAdmin, sub);
        const blindedText = blindSubmissionText({
          text: extractedText,
          studentName: sub.student_name,
          studentEmail: sub.student_email,
          fileName: sub.file_name,
        });
        const gradingInputHash = await buildGradingInputHash({
          submissionText: blindedText,
          rubric: normalizedRubric,
          assignmentInstructions: `${assignment.title}\n${assignment.description || ""}`,
          maxScore: assignment.max_score,
        });
        const contentFingerprint = computeContentFingerprint(assignment.id, blindedText);
        const existingMetadata =
          existingGrade?.grading_metadata && typeof existingGrade.grading_metadata === "object"
            ? existingGrade.grading_metadata
            : {};
        const existingHistory = normalizeHistory(existingMetadata);
        const existingHash =
          typeof existingMetadata.grading_input_hash === "string" ? existingMetadata.grading_input_hash : "";
        const existingPromptVersion =
          typeof existingMetadata.grading_prompt_version === "string" ? existingMetadata.grading_prompt_version : "";
        const existingFingerprint =
          typeof existingMetadata.content_fingerprint === "string" ? existingMetadata.content_fingerprint : "";
        const cacheHit =
          !forceRegenerate &&
          existingGrade?.ai_score != null &&
          existingHash === gradingInputHash &&
          existingPromptVersion === GRADING_PROMPT_VERSION;
        if (cacheHit) {
          const cachedBreakdown = normalizeBreakdown(existingGrade.ai_breakdown, normalizedRubric);
          const cachedConfidence = clampConfidence(existingGrade.grading_confidence ?? existingMetadata.confidence_score);
          const cachedResult = {
            submissionId: sub.id,
            score: Number(existingGrade.ai_score),
            feedback: existingGrade.ai_feedback || "Using saved AI marking result.",
            breakdown: cachedBreakdown.breakdown,
            assignmentType: classifyAssignmentType({
              title: assignment.title,
              description: assignment.description,
              rubricText,
              text: blindedText.substring(0, 18000),
            }),
            gradingConfidence: cachedConfidence,
            gradingMetadata: {
              ...existingMetadata,
              grading_input_hash: gradingInputHash,
              grading_prompt_version: GRADING_PROMPT_VERSION,
              cached_result: true,
              final_validated_score: Number(existingGrade.ai_score),
              cache_message: "Using saved AI marking result. Re-grade only if submission or rubric changes.",
              content_fingerprint: contentFingerprint,
              extraction: extractionMetadata,
            } as Record<string, unknown>,
          };
          console.log("grade-submission cache", {
            cache_hit: true,
            grading_input_hash: gradingInputHash,
            force_regenerate: forceRegenerate,
            ai_called: false,
            existing_score_returned: Number(existingGrade.ai_score),
            submissionId: sub.id,
          });
          results.push({
            submissionId: sub.id,
            score: cachedResult.score,
            feedback: cachedResult.feedback,
            breakdown: cachedResult.breakdown,
            assignmentType: cachedResult.assignmentType,
            gradingConfidence: cachedResult.gradingConfidence,
            requiresLecturerReview:
              Boolean(existingMetadata.lecturer_review_required) ||
              cachedBreakdown.breakdown.some((item) => item.review_required),
            reviewReasons: Array.from(
              new Set([
                ...cachedBreakdown.reviewReasons,
                "Cached final validated AI result returned because grading input hash matched.",
              ]),
            ),
            gradingMetadata: cachedResult.gradingMetadata,
            cacheMessage: "Using saved AI marking result. Re-grade only if submission or rubric changes.",
            rubricValidated: true,
            success: true,
          });
          continue;
        }
        console.log("grade-submission cache", {
            cache_hit: false,
            grading_input_hash: gradingInputHash,
            force_regenerate: forceRegenerate,
            ai_called: false,
            existing_score_returned: existingGrade?.ai_score == null ? null : Number(existingGrade.ai_score),
            submissionId: sub.id,
            existing_prompt_version: existingPromptVersion || null,
            existing_hash: existingHash || null,
            existing_fingerprint: existingFingerprint || null,
          });

        const matchingGeneratedResult = generatedResultsByFingerprint.get(gradingInputHash);
        if (matchingGeneratedResult) {
          console.log("grade-submission cache", {
            cache_hit: true,
            grading_input_hash: gradingInputHash,
            force_regenerate: forceRegenerate,
            ai_called: false,
            existing_score_returned: matchingGeneratedResult.score,
            submissionId: sub.id,
          });
          results.push({
            submissionId: sub.id,
            score: matchingGeneratedResult.score,
            feedback: `${matchingGeneratedResult.feedback}\n\nIdentical extracted content detected within this grading batch. Reused the same AI grade for consistency.`,
            breakdown: matchingGeneratedResult.breakdown,
            assignmentType: matchingGeneratedResult.assignmentType,
            gradingConfidence: matchingGeneratedResult.gradingConfidence,
            requiresLecturerReview: matchingGeneratedResult.requiresLecturerReview,
            reviewReasons: Array.from(
              new Set([
                ...matchingGeneratedResult.reviewReasons,
                "Identical extracted content detected within this grading batch; reused prior batch result.",
              ]),
            ),
            gradingMetadata: {
              ...matchingGeneratedResult.gradingMetadata,
              grading_input_hash: gradingInputHash,
              grading_prompt_version: GRADING_PROMPT_VERSION,
              cached_result: true,
              final_validated_score: matchingGeneratedResult.score,
              content_fingerprint: contentFingerprint,
              blind_grading_applied: true,
              reused_identical_content_grade: true,
              extraction: extractionMetadata,
            },
            rubricValidated: true,
            success: true,
          });
          continue;
        }

        const matchingExistingFingerprintCluster = existingGradesByFingerprint.get(contentFingerprint) ?? null;
        const matchingExistingFingerprintGrade = matchingExistingFingerprintCluster?.canonicalGrade ?? null;
        const matchingClusterMetadata =
          matchingExistingFingerprintGrade?.grading_metadata &&
            typeof matchingExistingFingerprintGrade.grading_metadata === "object"
            ? matchingExistingFingerprintGrade.grading_metadata
            : {};
        const matchingClusterHash =
          typeof matchingClusterMetadata.grading_input_hash === "string" ? matchingClusterMetadata.grading_input_hash : "";
        const matchingClusterPromptVersion =
          typeof matchingClusterMetadata.grading_prompt_version === "string"
            ? matchingClusterMetadata.grading_prompt_version
            : "";
        if (
          matchingExistingFingerprintGrade?.ai_score != null &&
          matchingClusterHash === gradingInputHash &&
          matchingClusterPromptVersion === GRADING_PROMPT_VERSION
        ) {
          console.log("grade-submission cache", {
            cache_hit: true,
            grading_input_hash: gradingInputHash,
            force_regenerate: forceRegenerate,
            ai_called: false,
            existing_score_returned: Number(matchingExistingFingerprintGrade.ai_score),
            submissionId: sub.id,
          });
          const reusedBreakdown = normalizeBreakdown(matchingExistingFingerprintGrade.ai_breakdown, normalizedRubric);
          const reusedConfidence = clampConfidence(matchingExistingFingerprintGrade.grading_confidence);
          const reusedMetadata = matchingClusterMetadata;
          const clusterMismatch =
            (matchingExistingFingerprintCluster?.gradeCount || 0) > 1 &&
            (matchingExistingFingerprintCluster?.scoreSpread || 0) > 0;
          results.push({
            submissionId: sub.id,
            score: Number(matchingExistingFingerprintGrade.ai_score),
            feedback: `${matchingExistingFingerprintGrade.ai_feedback || "Reused existing AI grade for identical content."}\n\nIdentical blinded content matched a previously graded submission in this assignment. Reused the canonical cluster grade for consistency.${clusterMismatch ? ` Historical duplicate grades for this same content varied by ${matchingExistingFingerprintCluster?.scoreSpread} marks, so the canonical cluster grade was applied and lecturer review is recommended.` : ""}`,
            breakdown: reusedBreakdown.breakdown,
            assignmentType: classifyAssignmentType({
              title: assignment.title,
              description: assignment.description,
              rubricText,
              text: blindedText.substring(0, 18000),
            }),
            gradingConfidence: clusterMismatch ? Math.min(reusedConfidence, 0.65) : reusedConfidence,
            requiresLecturerReview: clusterMismatch || reusedBreakdown.breakdown.some((item) => item.review_required),
            reviewReasons: Array.from(
              new Set([
                ...reusedBreakdown.reviewReasons,
                "Identical blinded content matched a previously graded submission in this assignment.",
                ...(clusterMismatch
                  ? [
                    `Historical duplicate grades for this same content varied by ${matchingExistingFingerprintCluster?.scoreSpread} marks; canonical cluster grade applied.`,
                  ]
                  : []),
              ]),
            ),
            gradingMetadata: {
              ...reusedMetadata,
              grading_input_hash: gradingInputHash,
              grading_prompt_version: GRADING_PROMPT_VERSION,
              cached_result: true,
              final_validated_score: Number(matchingExistingFingerprintGrade.ai_score),
              content_fingerprint: contentFingerprint,
              blind_grading_applied: true,
              reused_identical_content_grade: true,
              reused_from_submission_id: matchingExistingFingerprintGrade.submission_id,
              duplicate_cluster_grade_count: matchingExistingFingerprintCluster?.gradeCount || 1,
              duplicate_cluster_score_spread: matchingExistingFingerprintCluster?.scoreSpread || 0,
              extraction: extractionMetadata,
            },
            rubricValidated: true,
            success: true,
          });
          continue;
        }

        const textPreview = blindedText.substring(0, 18000);
        const assignmentType = classifyAssignmentType({
          title: assignment.title,
          description: assignment.description,
          rubricText,
          text: textPreview,
        });
        const isMathMode = assignmentType === "Mathematics" || assignmentType === "Problem Solving";

        const systemPrompt = buildSystemPrompt(assignmentType, normalizedRubric.length, assignment.max_score);
        const rubricCalibrationGuide = buildRubricCalibrationGuide(normalizedRubric, assignment.max_score);
        const prompt = `AssignmentType: ${assignmentType}

Assignment title: ${assignment.title}
Assignment description: ${assignment.description || "N/A"}
Module: ${assignment.module_code || "N/A"}
Maximum score: ${assignment.max_score}

Rubric:
${rubricText}

${rubricCalibrationGuide}

Evaluate criterion-by-criterion. Do not award a score unless supported by the submission evidence.
If evidence is weak or ambiguous, reduce confidence and require lecturer review.
For a single broad 100-mark criterion, use UK university bands:
- 70+: excellent distinction-level work
- 60-69: good work with reasonable methods and interpretation
- 50-59: competent work meeting the main requirements
- 40-49: only a basic partial attempt
- below 40: major omissions, off-topic, unreadable, or little relevant evidence
Do not assign the 40s to competent work that addresses the task and meets the main requirements unless several important elements are weak or missing.
${buildRegradeAnchorText(existingGrade)}
Submission text:
${textPreview}

Return valid JSON only.`;

        const previousAiScore = existingGrade?.ai_score != null ? Number(existingGrade.ai_score) : null;
        const passCandidates: GradingCandidate[] = [];
        for (let passIndex = 0; passIndex < GRADING_PASSES; passIndex++) {
          console.log("grade-submission ai-call", {
            cache_hit: false,
            grading_input_hash: gradingInputHash,
            force_regenerate: forceRegenerate,
            ai_called: true,
            existing_score_returned: previousAiScore,
            submissionId: sub.id,
            passIndex,
          });
          let passResult = await requestStructuredGrade({
            gradingModel,
            systemPrompt,
            prompt,
            rubricLength: normalizedRubric.length,
            isMathMode,
          });

          if (!passResult) continue;

          let candidate = buildGradingCandidate(passResult, normalizedRubric, assignment.max_score);
          if (candidate.positiveFeedbackLowScoreMismatch) {
            const reevaluationPrompt = `${prompt}

Your previous grading output was internally inconsistent: the feedback was broadly positive but the total score was below 40% of the maximum.

Previous JSON:
${JSON.stringify(passResult)}

Re-evaluate the rubric faithfully. If the evidence supports only a fail-range score, rewrite the feedback so it clearly explains failure against the rubric. Otherwise correct the criterion scores into a fair band. Return corrected JSON only.`;
            const reevaluated = await requestStructuredGrade({
              gradingModel,
              systemPrompt,
              prompt: reevaluationPrompt,
              rubricLength: normalizedRubric.length,
              isMathMode,
            });
            if (reevaluated) {
              passResult = reevaluated;
              candidate = buildGradingCandidate(passResult, normalizedRubric, assignment.max_score);
            }
          }

          passCandidates.push(candidate);
        }

        if (passCandidates.length === 0) throw new Error("Failed to parse AI response");

        const sortedPassCandidates = [...passCandidates].sort((a, b) => a.normalized.total - b.normalized.total);
        const selectedCandidate = sortedPassCandidates[Math.floor(sortedPassCandidates.length / 2)];
        const originalAiScoreBeforeValidation =
          selectedCandidate.modelScore ??
          normalizeOverallScore(
            selectedCandidate.gradeResult.total_score ?? selectedCandidate.gradeResult.score,
            assignment.max_score,
          );
        let gradeResult = selectedCandidate.gradeResult;
        let normalized = selectedCandidate.normalized;
        let modelScore = selectedCandidate.modelScore;
        let modelFeedback = selectedCandidate.modelFeedback;
        let gradingConfidence = clampConfidence(
          gradeResult.confidence_score ?? gradeResult.grading_confidence ?? normalized.averageConfidence,
        );
        let scoreAdjusted = selectedCandidate.scoreAdjusted;
        let positiveFeedbackLowScoreMismatch = selectedCandidate.positiveFeedbackLowScoreMismatch;
        const stabilityNotes: string[] = [];

        const passScores = sortedPassCandidates.map((candidate) => candidate.normalized.total);
        const passSpread =
          passScores.length > 0 ? Math.max(...passScores) - Math.min(...passScores) : 0;
        const passSpreadThreshold = getPassSpreadThreshold(assignment.max_score);
        if (passScores.length > 1) {
          stabilityNotes.push(
            `Consensus grading applied across ${passScores.length} passes. Pass scores: ${passScores.join(", ")}. Median score selected: ${normalized.total}.`,
          );
        }
        if (passSpread >= passSpreadThreshold) {
          stabilityNotes.push(
            `Pass spread ${passSpread} exceeded the review threshold of ${passSpreadThreshold}, so lecturer review was required.`,
          );
        }
        let regradeVariancePreservedPrior = false;
        if (
          previousAiScore != null &&
          hasMeaningfulScoreDrift(previousAiScore, normalized.total, assignment.max_score)
        ) {
          stabilityNotes.push(
            `Regrade drift detected: previous AI score ${previousAiScore}, new AI score ${normalized.total}. Running stability adjudication.`,
          );
          const consistencyPrompt = `${prompt}

The same submission was graded before. The previous stored AI score was ${previousAiScore}. Your current draft score is ${normalized.total}.

Previous stored grade:
${JSON.stringify({
  ai_score: previousAiScore,
  ai_feedback: existingGrade?.ai_feedback ?? "",
  ai_breakdown: Array.isArray(existingGrade?.ai_breakdown) ? existingGrade?.ai_breakdown : [],
})}

Current draft grade:
${JSON.stringify(gradeResult)}

STABILITY ADJUDICATION:
- Reconcile the prior and current grades against the same submission evidence.
- Keep the result close to the prior score unless the prior grade clearly misread the rubric.
- If a large score change is justified, explain exactly why in overall_feedback and set lecturer_review_required to true.

Return corrected JSON only.`;
          const stabilized = await requestStructuredGrade({
            gradingModel,
            systemPrompt,
            prompt: consistencyPrompt,
            rubricLength: normalizedRubric.length,
            isMathMode,
          });

          if (stabilized) {
            gradeResult = stabilized;
            normalized = normalizeBreakdown(gradeResult.criteria ?? gradeResult.breakdown, normalizedRubric);
            modelScore = normalizeOverallScore(gradeResult.total_score ?? gradeResult.score, assignment.max_score);
            modelFeedback =
              typeof (gradeResult.overall_feedback ?? gradeResult.feedback) === "string" &&
                String(gradeResult.overall_feedback ?? gradeResult.feedback).trim()
                ? String(gradeResult.overall_feedback ?? gradeResult.feedback).trim()
                : modelFeedback;
            scoreAdjusted = modelScore != null && Math.abs(modelScore - normalized.total) > 1;
            positiveFeedbackLowScoreMismatch = detectPositiveFeedbackLowScoreMismatch(
              modelFeedback,
              normalized.total,
              assignment.max_score,
            );
            stabilityNotes.push(`Stability adjudication returned score ${normalized.total}.`);
          }

          if (hasMeaningfulScoreDrift(previousAiScore, normalized.total, assignment.max_score)) {
            const previousNormalized = normalizeBreakdown(existingGrade?.ai_breakdown, normalizedRubric);
            if (previousNormalized.breakdown.length > 0) {
              normalized = {
                ...previousNormalized,
                fairnessNotes: [...previousNormalized.fairnessNotes],
              };
            }
            modelScore = previousAiScore;
            modelFeedback =
              existingGrade?.ai_feedback?.trim() ||
              "Previous AI grade preserved because repeated regrading produced materially different scores for the same submission.";
            gradingConfidence = Math.min(clampConfidence(existingGrade?.grading_confidence), 0.65);
            regradeVariancePreservedPrior = true;
            stabilityNotes.push(
              `Material score drift remained after adjudication, so the prior AI score ${previousAiScore} was preserved and lecturer review was required.`,
            );
          }
        }

        gradingConfidence = clampConfidence(
          gradeResult.confidence_score ?? gradeResult.grading_confidence ?? normalized.averageConfidence,
        );
        if (regradeVariancePreservedPrior) {
          gradingConfidence = Math.min(gradingConfidence, 0.65);
        }
        if (passSpread >= passSpreadThreshold) {
          gradingConfidence = Math.min(gradingConfidence, 0.65);
        }
        const reviewReasons = Array.isArray(gradeResult.review_reasons)
          ? gradeResult.review_reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        const mathAnalysis = normalizeMathAnalysis(gradeResult.math_analysis);
        const fairnessNotes = [...normalized.fairnessNotes];
        let fairnessRecalibrationApplied = false;
        const preRecalibrationScore = normalized.total;
        const initialSingleCriterion = normalized.breakdown.length === 1 ? normalized.breakdown[0] : null;
        let evidenceCoverage = initialSingleCriterion
          ? detectEvidenceCoverage({
            submissionText: blindedText,
            feedback: modelFeedback,
            reasonForScore: initialSingleCriterion.reason_for_score,
            evidenceText: initialSingleCriterion.evidence_from_submission,
          })
          : null;
        let ukBand = deriveUkBand(normalized.total, assignment.max_score);
        const relevanceAssessment = assessSubmissionRelevance({
          assignmentTitle: assignment.title,
          assignmentInstructions: assignment.description ?? "",
          rubric: normalizedRubric,
          submissionText: blindedText,
          feedback: modelFeedback,
          criterionReasons: normalized.breakdown.map((item) => item.reason_for_score),
        });
        const relevanceBlocksFairness = relevanceAssessment.classification !== "RELEVANT";
        if (positiveFeedbackLowScoreMismatch && normalized.breakdown.length === 1) {
          const single = normalized.breakdown[0];
          const integrityRiskHigh =
            Boolean(mathAnalysis?.solver_signals.length) ||
            reviewReasons.some((reason) =>
              /academic integrity|suspected ai|inconsistent voice|implausible sophistication/i.test(reason)
            );
          if (!relevanceBlocksFairness) {
            const recalibratedBand = resolveSingleCriterionFairnessRecalibration({
              feedback: modelFeedback,
              reasonForScore: single.reason_for_score,
              awardedScore: single.score,
              evidenceText: single.evidence_from_submission,
              submissionText: blindedText,
              maxScore: assignment.max_score,
          extractionSuccess: extractionMetadata.extraction_success === true,
              extractedTextLength: Number(extractionMetadata.extracted_text_length || 0),
              integrityRiskHigh,
            });
            if (recalibratedBand != null && normalized.total < recalibratedBand.score) {
              normalized = {
                ...normalized,
                breakdown: normalized.breakdown.map((item) => ({
                  ...item,
                  score: recalibratedBand.score,
                  performance_band: recalibratedBand.performanceBand,
                  confidence_score: Math.min(item.confidence_score, 0.7),
                  review_required: true,
                })),
                total: recalibratedBand.score,
              };
              fairnessNotes.push(recalibratedBand.note);
              gradingConfidence = Math.min(gradingConfidence, 0.7);
              fairnessRecalibrationApplied = true;
              evidenceCoverage = recalibratedBand.evidenceCoverage;
              ukBand = recalibratedBand.ukBand;
            }
          }
        }
        if (
          !fairnessRecalibrationApplied &&
          evidenceCoverage &&
          normalized.breakdown.length === 1 &&
          !(mathAnalysis?.solver_signals.length) &&
          !relevanceBlocksFairness
        ) {
          let coverageTarget: number | null = null;
          if (
            evidenceCoverage.coverage_count >= 7 &&
            evidenceCoverage.two_methods_present &&
            evidenceCoverage.interpretation_present &&
            evidenceCoverage.methods_relevant &&
            normalized.total < 60
          ) {
            coverageTarget = 60;
          } else if (evidenceCoverage.coverage_count >= 6 && normalized.total < 55) {
            coverageTarget = 60;
          } else if (evidenceCoverage.coverage_count >= 5 && normalized.total < 50) {
            coverageTarget = 55;
          }

          if (coverageTarget != null) {
            const currentBand = deriveUkBand(coverageTarget, assignment.max_score);
            normalized = {
              ...normalized,
              breakdown: normalized.breakdown.map((item) => ({
                ...item,
                score: coverageTarget as number,
                performance_band: coverageTarget >= 60 ? "Good" : "Satisfactory",
                confidence_score: Math.min(item.confidence_score, 0.7),
                review_required: true,
              })),
              total: coverageTarget,
            };
            fairnessNotes.push(
              "Score recalibrated using UK university marking bands because the submission met the main assignment requirements and the original score was below the expected band.",
            );
            gradingConfidence = Math.min(gradingConfidence, 0.7);
            fairnessRecalibrationApplied = true;
            ukBand = currentBand;
          }
        }
        if (relevanceAssessment.classification === "OFF_TOPIC") {
          fairnessNotes.push("Fairness recalibration skipped because the submission does not address the assignment brief.");
          gradingConfidence = Math.min(gradingConfidence, 0.7);
        } else if (relevanceAssessment.classification === "PARTIALLY_RELEVANT") {
          fairnessNotes.push("Fairness recalibration skipped because the submission addresses the wrong task.");
          gradingConfidence = Math.min(gradingConfidence, 0.7);
        }
        if (relevanceAssessment.classification !== "RELEVANT" && normalized.total >= 40) {
          const cappedScore = relevanceAssessment.classification === "OFF_TOPIC"
            ? Math.min(preRecalibrationScore, 20)
            : Math.min(preRecalibrationScore, 39);
          normalized = {
            ...normalized,
            breakdown: redistributeBreakdownToTotal(normalized.breakdown, cappedScore),
            total: cappedScore,
          };
          fairnessNotes.push(
            "Score corrected because fairness recalibration attempted to raise a non-relevant submission into a passing band.",
          );
          gradingConfidence = Math.min(gradingConfidence, 0.7);
          fairnessRecalibrationApplied = false;
        }
        ukBand = deriveUkBand(normalized.total, assignment.max_score);
        if (scoreAdjusted) {
          fairnessNotes.push("Total score was recalculated to match the exact sum of criterion awarded_scores.");
        }
        if (isNearGradeBoundary(normalized.total, assignment.max_score)) {
          reviewReasons.push("Total score falls within 3 marks of a grade boundary.");
        }

        if (mathAnalysis?.solver_signals.length) {
          reviewReasons.push(...mathAnalysis.solver_signals.map((signal) => `Solver signal: ${signal}`));
        }

        reviewReasons.push(...normalized.reviewReasons);
        if (positiveFeedbackLowScoreMismatch && !fairnessRecalibrationApplied) {
          reviewReasons.push("Score/feedback mismatch: positive rubric summary paired with a mark below 40%");
          fairnessNotes.push("Fairness warning: positive feedback was paired with a fail-range score.");
        }
        if (normalized.recalibrated) {
          reviewReasons.push("One or more criterion scores were recalibrated during backend validation.");
        }
        if (fairnessRecalibrationApplied) {
          reviewReasons.push("UK band fairness recalibration applied.");
        }
        if (relevanceAssessment.classification !== "RELEVANT") {
          reviewReasons.push(...relevanceAssessment.reasons);
        }
        if (regradeVariancePreservedPrior) {
          reviewReasons.push("Repeated regrading produced materially different scores, so the prior AI grade was preserved.");
        }
        if (passSpread >= passSpreadThreshold) {
          reviewReasons.push(
            `Consensus grading spread was ${passSpread} across ${passScores.length} passes, exceeding the review threshold of ${passSpreadThreshold}.`,
          );
        }
        const recalibrationApplied =
          fairnessRecalibrationApplied || normalized.recalibrated || scoreAdjusted || positiveFeedbackLowScoreMismatch;
        if (recalibrationApplied) {
          gradingConfidence = Math.min(gradingConfidence, 0.7);
        }

        const requiresLecturerReview =
          Boolean(gradeResult.lecturer_review_required ?? gradeResult.requires_lecturer_review) ||
          gradingConfidence < CONFIDENCE_THRESHOLD ||
          normalized.breakdown.some((item) => item.review_required) ||
          Boolean(mathAnalysis?.solver_signals.length) ||
          positiveFeedbackLowScoreMismatch ||
          normalized.recalibrated ||
          fairnessRecalibrationApplied ||
          relevanceAssessment.classification !== "RELEVANT" ||
          passSpread >= passSpreadThreshold ||
          regradeVariancePreservedPrior ||
          isNearGradeBoundary(normalized.total, assignment.max_score);

        const feedbackParts = [modelFeedback];
        if (scoreAdjusted) {
          feedbackParts.push("Final score was recalculated to match the exact sum of criterion scores.");
        }
        if (fairnessRecalibrationApplied && fairnessNotes.length > 0) {
          feedbackParts.push(fairnessNotes[fairnessNotes.length - 1]);
        }
        if (stabilityNotes.length > 0) {
          feedbackParts.push(stabilityNotes[stabilityNotes.length - 1]);
        }
        if (recalibrationApplied) {
          feedbackParts.push(
            fairnessRecalibrationApplied
              ? "Initial AI score was inconsistent with UK marking bands. A fairness recalibration was applied and lecturer review is recommended."
              : "Initial AI score was inconsistent with feedback. A fairness adjustment was applied.",
          );
        }
        if (requiresLecturerReview && reviewReasons.length > 0) {
          feedbackParts.push(`Lecturer review recommended: ${Array.from(new Set(reviewReasons)).join("; ")}`);
        }

        const gradingHistory =
          existingGrade?.ai_score != null || forceRegenerate || existingHash !== gradingInputHash
            ? [
              ...existingHistory,
              {
                previous_score: existingGrade?.ai_score == null ? null : Number(existingGrade.ai_score),
                new_score: normalized.total,
                previous_confidence:
                  existingGrade?.grading_confidence == null ? null : clampConfidence(existingGrade.grading_confidence),
                new_confidence: gradingConfidence,
                grading_input_hash: gradingInputHash,
                prompt_version: GRADING_PROMPT_VERSION,
                timestamp: new Date().toISOString(),
                reason_for_regrade: forceRegenerate ? regradeReason : existingHash && existingHash !== gradingInputHash ? regradeReason : "Initial grade generation.",
              } satisfies GradingHistoryEntry,
            ]
            : existingHistory;

        results.push({
          submissionId: sub.id,
          score: normalized.total,
          feedback: feedbackParts.join("\n\n"),
          breakdown: normalized.breakdown,
          assignmentType,
          gradingConfidence,
          requiresLecturerReview,
          reviewReasons: Array.from(new Set(reviewReasons)),
          gradingMetadata: {
            rubric_validated: true,
            confidence_threshold: CONFIDENCE_THRESHOLD,
            grading_prompt_version: GRADING_PROMPT_VERSION,
            grading_input_hash: gradingInputHash,
            cached_result: false,
            force_regenerate: forceRegenerate,
            math_analysis: mathAnalysis,
            fairness_notes: Array.from(new Set(fairnessNotes)),
            stability_notes: Array.from(new Set(stabilityNotes)),
            original_ai_score: originalAiScoreBeforeValidation,
            final_validated_score: normalized.total,
            uk_band: ukBand,
            relevance_classification: relevanceAssessment.classification,
            relevance_reasons: relevanceAssessment.reasons,
            evidence_coverage: evidenceCoverage,
            previous_ai_score: previousAiScore,
            recalibration_applied: recalibrationApplied,
            lecturer_review_required: requiresLecturerReview,
            grading_history: gradingHistory,
            content_fingerprint: contentFingerprint,
            blind_grading_applied: true,
            grading_pass_count: passScores.length,
            grading_pass_scores: passScores,
            grading_pass_spread: passSpread,
            grading_pass_spread_threshold: passSpreadThreshold,
            main_strengths: normalizeStringList(gradeResult.main_strengths),
            main_weaknesses: normalizeStringList(gradeResult.main_weaknesses),
            extraction: extractionMetadata,
          },
          rubricValidated: true,
          success: true,
        });
        generatedResultsByFingerprint.set(gradingInputHash, {
          score: normalized.total,
          feedback: feedbackParts.join("\n\n"),
          breakdown: normalized.breakdown,
          assignmentType,
          gradingConfidence,
          requiresLecturerReview,
          reviewReasons: Array.from(new Set(reviewReasons)),
          gradingMetadata: {
            rubric_validated: true,
            confidence_threshold: CONFIDENCE_THRESHOLD,
            grading_prompt_version: GRADING_PROMPT_VERSION,
            grading_input_hash: gradingInputHash,
            cached_result: false,
            force_regenerate: forceRegenerate,
            math_analysis: mathAnalysis,
            fairness_notes: Array.from(new Set(fairnessNotes)),
            stability_notes: Array.from(new Set(stabilityNotes)),
            original_ai_score: originalAiScoreBeforeValidation,
            final_validated_score: normalized.total,
            uk_band: ukBand,
            relevance_classification: relevanceAssessment.classification,
            relevance_reasons: relevanceAssessment.reasons,
            evidence_coverage: evidenceCoverage,
            previous_ai_score: previousAiScore,
            recalibration_applied: recalibrationApplied,
            lecturer_review_required: requiresLecturerReview,
            grading_history: gradingHistory,
            content_fingerprint: contentFingerprint,
            blind_grading_applied: true,
            grading_pass_count: passScores.length,
            grading_pass_scores: passScores,
            grading_pass_spread: passSpread,
            grading_pass_spread_threshold: passSpreadThreshold,
            main_strengths: normalizeStringList(gradeResult.main_strengths),
            main_weaknesses: normalizeStringList(gradeResult.main_weaknesses),
            extraction: extractionMetadata,
          },
        });
        console.log("grade-submission generated", {
          submissionId: sub.id,
          gradingInputHash,
          promptVersion: GRADING_PROMPT_VERSION,
          forceRegenerate,
          recalibrationApplied,
        });
      } catch (gradeErr) {
        console.error("Grading error for", sub.id, gradeErr);
        results.push({
          submissionId: sub.id,
          error: gradeErr instanceof Error ? gradeErr.message : String(gradeErr),
          success: false,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-submission error:", e);
    return jsonError(e, corsHeaders);
  }
});
