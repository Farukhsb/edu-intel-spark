import { z } from "npm:zod";
import type { createAdminClient, requireLecturer } from "../_shared/auth.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  extractSubmissionDocument,
  logDocumentExtractionResult,
} from "../_shared/document-extraction.ts";
import { createResponse, extractOutputText, parseJsonText } from "../_shared/openai.ts";
import { applyRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";
import {
  assessExtractionQuality,
  computeBaselineDeviation,
  computeWritingProfileMetrics,
  mergeWritingProfile,
  normalizeReadableText,
  type StoredWritingProfile,
  type WritingProfileMetrics,
} from "../_shared/text-analysis.ts";
import { analyzeTextSimilarity } from "../_shared/providers/internal-text-similarity.ts";
import type { IntegrityProviderFinding } from "../_shared/integrity-provider.ts";
import { upsertIntegrityFindings } from "../_shared/integrity-findings-store.ts";
import { buildInternalSimilarityFlagCandidates } from "../_shared/internal-similarity-flags.ts";
import {
  runMossSimilarityComparisons,
  type InternalSimilaritySubmission,
} from "../_shared/integrity-provider-runners.ts";
import { detectMossLanguage, type MossRunnerConfig } from "../_shared/providers/moss.ts";
import { buildInternalComparisonPairs } from "./internal-comparison-pairs.ts";
import { mapWithConcurrency } from "./map-with-concurrency.ts";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type CheckPlagiarismHandlerDeps = {
  createAdminClient: typeof createAdminClient;
  requireLecturer: typeof requireLecturer;
  jsonError: (error: unknown, corsHeaders: Record<string, string>) => Response;
  getCorsHeaders: (req: Request) => Record<string, string> | null;
  createCorsForbiddenResponse: () => Response;
  createIntegrityResponseWithRetry?: (
    body: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
};

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

const ExistingReviewNoteSchema = z.object({
  latestNote: z.string().catch(""),
  history: z.array(z.unknown()).catch([]),
});

function readEnv(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }

  return undefined;
}

const MAX_SINGLE_TEXT_CHARS = 12000;
const MAX_MULTI_TEXT_CHARS = 3500;
const EXTRACTION_CONCURRENCY = 4;
const LARGE_COHORT_WARNING_THRESHOLD = 30;
const MAX_INTERNAL_COMPARISON_SUBMISSIONS = 80;
const MAX_REQUESTED_SUBMISSION_IDS = 80;
const OPENAI_RETRY_ATTEMPTS = 2;
const MIN_INTEGRITY_FLAG_SCORE = 25;
const INTERNAL_SIMILARITY_MIN_WORDS = 50;

const CheckPlagiarismRequestSchema = z
  .object({
    submissionId: z.string().uuid().optional(),
    submissionIds: z.array(z.string().uuid()).max(MAX_REQUESTED_SUBMISSION_IDS).optional(),
    assignmentId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.submissionId) || Boolean(value.submissionIds?.length), {
    message: "At least one of submissionId or submissionIds is required",
    path: ["submissionIds"],
  });
const includeValidationDetails = readEnv("ENV") === "development";

type IntegrityProviderMode = "llm_legacy" | "internal_text_similarity" | "both";

type IntegrityType = "similarity" | "ai-writing" | "baseline-deviation" | "mixed";

type IntegrityFlag = {
  student_a: string;
  student_b: string;
  submission_a_id: string;
  submission_b_id: string;
  similarity_score: number;
  ai_suspicion_score: number;
  baseline_deviation_score: number;
  total_risk_score: number;
  reason: string;
  evidence_summary: string;
  matched_excerpt: string;
  recommended_action: "clear" | "review" | "investigate";
  integrity_type: IntegrityType;
  severity: "low" | "medium" | "high";
  overlap_analysis?: {
    total_overlap: number;
    cited_overlap: number;
    uncited_overlap: number;
    internal_peer_overlap: number;
    external_source_overlap: number;
    reference_section_overlap?: number;
    heavy_source_reliance?: boolean;
  };
  evidence_groups?: {
    uncited_matches: Array<{ label: string; value: string; score: number }>;
    cited_matches: Array<{ label: string; value: string; score: number }>;
    peer_matches: Array<{ label: string; value: string; score: number }>;
    external_matches: Array<{ label: string; value: string; score: number }>;
  };
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  file_name: string | null;
  file_url?: string;
};

function toProviderSubmission(submission: SubmissionRow): InternalSimilaritySubmission {
  return {
    id: submission.id,
    assignment_id: submission.assignment_id,
    student_id: submission.student_id,
    student_name: submission.student_name,
    student_email: submission.student_email,
    file_name: submission.file_name,
    file_url: submission.file_url,
  };
}

type EvidenceItem = { label: string; value: string; score: number };

type ProcessedSubmissionText = {
  originalText: string;
  mainBody: string;
  referenceSection: string;
  hasReferenceSection: boolean;
  quotedChars: number;
  citationPatternCount: number;
  quoteShare: number;
  extractionQuality?: {
    isUsable: boolean;
    wordCount: number;
    artifactRatio: number;
    qualityScore: number;
    reasons: string[];
  };
};

function clampScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeSeverity(value: unknown): IntegrityFlag["severity"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeAction(value: unknown): IntegrityFlag["recommended_action"] {
  return value === "clear" || value === "review" || value === "investigate" ? value : "review";
}

const REFERENCE_SECTION_HEADING = /^\s*(references|bibliography|works cited)\s*:?\s*$/i;
const NUMERIC_CITATION_PATTERN = /\[(?:\d+(?:\s*,\s*\d+|\s*-\s*\d+)*)\]/g;
const PARENTHETICAL_CITATION_PATTERN =
  /\(([A-Z][A-Za-z'`-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z'`-]+)?(?:\s+et al\.)?,\s*(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.?\s*\d+(?:-\d+)?)?)\)/g;
const NARRATIVE_CITATION_PATTERN =
  /\b[A-Z][A-Za-z'`-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z'`-]+)?(?:\s+et al\.)?\s*\((?:19|20)\d{2}[a-z]?\)/g;
const URL_OR_DOI_PATTERN = /\b(?:https?:\/\/\S+|www\.\S+|doi:\s*\S+|10\.\d{4,9}\/[\-._;()\/:A-Z0-9]+)\b/gi;
const QUOTED_BLOCK_PATTERN = /["â€œ][^"â€]{20,}["â€]/g;
const COMMON_ACADEMIC_PHRASES = [
  "in conclusion",
  "this essay will",
  "the results of this study",
  "it is important to note",
  "on the other hand",
  "the purpose of this study",
  "as shown in figure",
  "the findings suggest that",
];
const ASCII_QUOTED_BLOCK_PATTERN = /"[^"]{20,}"/g;

function collapseWhitespace(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function resolveIntegrityProviderMode(rawBody: Record<string, unknown> | null): IntegrityProviderMode {
  const envProvider = readEnv("INTEGRITY_PROVIDER_MODE")?.trim().toLowerCase() || "";
  if (envProvider === "llm_legacy" || envProvider === "internal_text_similarity" || envProvider === "both") {
    return envProvider;
  }
  return "both";
}

function resolveMossRunnerConfig(): MossRunnerConfig | null {
  const isEnabled = readEnv("MOSS_PROVIDER_ENABLED")?.trim().toLowerCase() === "true";
  if (!isEnabled) return null;

  const runnerUrl = readEnv("MOSS_RUNNER_URL")?.trim() || "";
  if (!runnerUrl) {
    logWarn("moss_runner_config_missing_url", {
      function: "check-plagiarism",
    });
    return null;
  }

  const timeoutMs = Number(readEnv("MOSS_RUNNER_TIMEOUT_MS") || "20000");

  return {
    runnerUrl,
    apiKey: readEnv("MOSS_RUNNER_API_SECRET")?.trim() || readEnv("MOSS_RUNNER_BEARER_TOKEN")?.trim() || null,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20_000,
  };
}

function supportsInternalTextSimilarity(content: {
  plainText: string;
  fileType: string;
  success: boolean;
  extractionError: string | null;
  extractionQuality: ReturnType<typeof assessExtractionQuality> | null;
}) {
  if (!content.success || content.extractionError) return false;
  if (content.extractionQuality && !content.extractionQuality.isUsable) return false;
  if (!["pdf", "docx", "txt"].includes(content.fileType)) return false;
  return countWords(content.plainText) >= INTERNAL_SIMILARITY_MIN_WORDS;
}

function countCitationPatterns(text: string) {
  return [
    ...(text.match(NUMERIC_CITATION_PATTERN) || []),
    ...(text.match(PARENTHETICAL_CITATION_PATTERN) || []),
    ...(text.match(NARRATIVE_CITATION_PATTERN) || []),
    ...(text.match(URL_OR_DOI_PATTERN) || []),
  ].length;
}

function hasCitationPattern(text: string) {
  return Boolean(
    text.match(NUMERIC_CITATION_PATTERN) ||
    text.match(PARENTHETICAL_CITATION_PATTERN) ||
    text.match(NARRATIVE_CITATION_PATTERN) ||
    text.match(URL_OR_DOI_PATTERN),
  );
}

function splitReferenceSection(text: string) {
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line, index) => index > 0 && REFERENCE_SECTION_HEADING.test(line.trim()));
  if (headingIndex === -1) {
    return {
      mainBody: text,
      referenceSection: "",
      hasReferenceSection: false,
    };
  }

  return {
    mainBody: normalizeReadableText(lines.slice(0, headingIndex).join("\n")),
    referenceSection: normalizeReadableText(lines.slice(headingIndex).join("\n")),
    hasReferenceSection: true,
  };
}

function preprocessSubmissionText(text: string): ProcessedSubmissionText {
  const normalized = normalizeReadableText(text);
  const { mainBody, referenceSection, hasReferenceSection } = splitReferenceSection(normalized);
  const quotedBlocks = mainBody.match(ASCII_QUOTED_BLOCK_PATTERN) || mainBody.match(QUOTED_BLOCK_PATTERN) || [];
  const quotedChars = quotedBlocks.reduce((sum, block) => sum + block.length, 0);
  const citationPatternCount = countCitationPatterns(mainBody);

  return {
    originalText: normalized,
    mainBody,
    referenceSection,
    hasReferenceSection,
    quotedChars,
    citationPatternCount,
    quoteShare: mainBody.length > 0 ? quotedChars / mainBody.length : 0,
  };
}

function excerptWordCount(excerpt: string) {
  return excerpt.trim().split(/\s+/).filter(Boolean).length;
}

function isRepeatedAcademicPhrase(excerpt: string) {
  const normalized = collapseWhitespace(excerpt);
  return excerptWordCount(excerpt) < 8 || COMMON_ACADEMIC_PHRASES.some((phrase) => normalized.includes(phrase));
}

function excerptMatchesSection(sectionText: string, excerpt: string) {
  if (!sectionText || !excerpt.trim()) return false;
  const collapsedSection = collapseWhitespace(sectionText);
  const collapsedExcerpt = collapseWhitespace(excerpt);
  if (!collapsedExcerpt) return false;
  return collapsedSection.includes(collapsedExcerpt) ||
    (collapsedExcerpt.length > 40 && collapsedSection.includes(collapsedExcerpt.slice(0, 40)));
}

function excerptAppearsQuotedOrCited(text: string, excerpt: string) {
  if (!text || !excerpt.trim()) return false;
  if (/^".*"$/.test(excerpt.trim())) return true;
  if (/^["â€œ].*["â€]$/.test(excerpt.trim())) return true;

  const candidates = [excerpt.trim(), excerpt.trim().slice(0, 120), excerpt.trim().slice(0, 80)].filter(
    (candidate) => candidate.length >= 20,
  );

  for (const candidate of candidates) {
    const index = text.indexOf(candidate);
    if (index === -1) continue;

    const before = text.slice(Math.max(0, index - 120), index);
    const after = text.slice(index + candidate.length, index + candidate.length + 140);
    if (before.trimEnd().endsWith(`"`) || after.trimStart().startsWith(`"`)) return true;
    const quoteLead = before.trimEnd().endsWith(`"`) || before.trimEnd().endsWith(`â€œ`);
    const quoteTail = after.trimStart().startsWith(`"`) || after.trimStart().startsWith(`â€`);
    if (quoteLead || quoteTail) return true;

    if (hasCitationPattern(after) || hasCitationPattern(before)) {
      return true;
    }
  }

  return false;
}

function buildFallbackEvidenceItem(label: string, value: string, score: number): EvidenceItem {
  return { label, value: value.trim(), score: clampScore(score) };
}

function normalizeArtifactDrivenReason(params: {
  reason: string;
  evidenceSummary: string;
  totalRisk: number;
  overlap: {
    total_overlap: number;
    cited_overlap: number;
    uncited_overlap: number;
    internal_peer_overlap: number;
    external_source_overlap: number;
    reference_section_overlap?: number;
    heavy_source_reliance?: boolean;
  };
}) {
  const combined = `${params.reason} ${params.evidenceSummary}`.toLowerCase();
  const artifactSignals = [
    "artifact",
    "artifacts",
    "binary",
    "docx",
    "xml",
    "archive",
    "file structure",
    "document format",
    "formatting noise",
    "extraction issue",
    "extraction issues",
    "extraction quality",
    "non-textual",
    "non textual",
    "file-container",
    "container data",
    "package data",
    "format artefact",
    "format artifact",
  ];
  const impliesSubstantiveOverlap = [
    "high substantive overlap",
    "very high substantive overlap",
    "high overlap",
    "very high overlap",
    "substantive overlap",
    "clear plagiarism in prose",
    "meaningful variation in the main body",
  ];

  const artifactDominated = artifactSignals.some((signal) => combined.includes(signal));
  const lowRisk = params.totalRisk < 45;

  if (!artifactDominated) {
    return params.reason;
  }

  if (lowRisk || impliesSubstantiveOverlap.some((signal) => combined.includes(signal))) {
    if ((params.overlap.uncited_overlap || 0) > 0) {
      return "Apparent overlap is driven by file structure rather than meaningful assignment content, so the similarity signal reflects document-format artifacts rather than substantive content similarity.";
    }
    return "High structural similarity due to document format artifacts, not substantive content overlap.";
  }

  return params.reason
    .replace(/high substantive overlap/gi, "high structural similarity due to document format artifacts")
    .replace(/very high substantive overlap/gi, "very high structural similarity due to document format artifacts")
    .replace(/high overlap/gi, "high structural similarity")
    .replace(/substantive overlap/gi, "structural similarity due to document format artifacts");
}

function classifySimilarityContext(
  excerpt: string,
  submissionA: ProcessedSubmissionText | undefined,
  submissionB: ProcessedSubmissionText | undefined,
) {
  if (!excerpt.trim()) return "uncited";
  if (isRepeatedAcademicPhrase(excerpt)) return "common";
  if (
    (submissionA && excerptMatchesSection(submissionA.referenceSection, excerpt)) ||
    (submissionB && excerptMatchesSection(submissionB.referenceSection, excerpt))
  ) {
    return "reference";
  }

  if (
    (submissionA && excerptAppearsQuotedOrCited(submissionA.originalText, excerpt)) ||
    (submissionB && excerptAppearsQuotedOrCited(submissionB.originalText, excerpt))
  ) {
    return "cited";
  }

  return "uncited";
}

function deriveCitationAwareOverlap(params: {
  baseSimilarity: number;
  excerpt: string;
  submissionA?: ProcessedSubmissionText;
  submissionB?: ProcessedSubmissionText;
  provided?: Record<string, unknown>;
  isPeerMatch: boolean;
}) {
  const { baseSimilarity, excerpt, submissionA, submissionB, provided, isPeerMatch } = params;
  if (
    (submissionA?.extractionQuality && !submissionA.extractionQuality.isUsable) ||
    (submissionB?.extractionQuality && !submissionB.extractionQuality.isUsable)
  ) {
    return {
      classification: "uncited",
      effectiveSimilarity: 0,
      overlap: {
        total_overlap: 0,
        cited_overlap: 0,
        uncited_overlap: 0,
        internal_peer_overlap: 0,
        external_source_overlap: 0,
        reference_section_overlap: 0,
        heavy_source_reliance: false,
      },
    };
  }

  const classification = classifySimilarityContext(excerpt, submissionA, submissionB);
  const providedTotal = clampScore(provided?.total_overlap);
  const totalOverlap = providedTotal || baseSimilarity;
  let citedOverlap = clampScore(provided?.cited_overlap);
  let uncitedOverlap = clampScore(provided?.uncited_overlap);
  let internalPeerOverlap = clampScore(provided?.internal_peer_overlap);
  let externalSourceOverlap = clampScore(provided?.external_source_overlap);
  let referenceSectionOverlap = clampScore(provided?.reference_section_overlap);

  if (classification === "reference") {
    citedOverlap = 0;
    uncitedOverlap = 0;
    internalPeerOverlap = isPeerMatch ? totalOverlap : internalPeerOverlap;
    externalSourceOverlap = isPeerMatch ? externalSourceOverlap : Math.max(externalSourceOverlap, totalOverlap);
    referenceSectionOverlap = totalOverlap;
  } else if (classification === "cited") {
    citedOverlap = totalOverlap;
    uncitedOverlap = 0;
    if (isPeerMatch) internalPeerOverlap = Math.max(internalPeerOverlap, totalOverlap);
  } else if (classification === "common") {
    citedOverlap = Math.max(citedOverlap, Math.round(totalOverlap * 0.35));
    uncitedOverlap = 0;
    if (isPeerMatch) internalPeerOverlap = Math.max(internalPeerOverlap, Math.round(totalOverlap * 0.35));
  } else if (uncitedOverlap === 0) {
    uncitedOverlap = totalOverlap;
    if (isPeerMatch) internalPeerOverlap = Math.max(internalPeerOverlap, totalOverlap);
  }

  const heavySourceReliance =
    (submissionA?.quoteShare || 0) >= 0.2 ||
    (submissionB?.quoteShare || 0) >= 0.2 ||
    citedOverlap >= 25;

  const effectiveSimilarity =
    classification === "reference"
      ? 0
      : classification === "common"
        ? Math.round(totalOverlap * 0.1)
        : clampScore(uncitedOverlap + citedOverlap * 0.15);

  return {
    classification,
    effectiveSimilarity,
    overlap: {
      total_overlap: totalOverlap,
      cited_overlap: citedOverlap,
      uncited_overlap: uncitedOverlap,
      internal_peer_overlap: internalPeerOverlap,
      external_source_overlap: externalSourceOverlap,
      reference_section_overlap: referenceSectionOverlap,
      heavy_source_reliance: heavySourceReliance,
    },
  };
}

function normalizeType(value: unknown): IntegrityType {
  return value === "similarity" || value === "ai-writing" || value === "baseline-deviation" || value === "mixed"
    ? value
    : "mixed";
}

function enforceScoreBand(score: number, min: number, max: number) {
  return Math.max(min, Math.min(max, score));
}

function normalizeScoresByContext(
  similarityScore: number,
  aiSuspicionScore: number,
  severity: IntegrityFlag["severity"],
  integrityType: IntegrityType,
  recommendedAction: IntegrityFlag["recommended_action"],
) {
  let normalizedSimilarity = similarityScore;
  let normalizedAi = aiSuspicionScore;

  if (integrityType === "similarity" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 75, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 45, 74);
    } else {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 0, 44);
    }
  } else {
    normalizedSimilarity = Math.min(normalizedSimilarity, 35);
  }

  if (integrityType === "ai-writing" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedAi = enforceScoreBand(normalizedAi, 70, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedAi = enforceScoreBand(normalizedAi, 45, 69);
    } else {
      normalizedAi = enforceScoreBand(normalizedAi, 0, 44);
    }
  } else {
    normalizedAi = Math.min(normalizedAi, 35);
  }

  return {
    similarityScore: normalizedSimilarity,
    aiSuspicionScore: normalizedAi,
  };
}

function severityFromRisk(score: number): IntegrityFlag["severity"] {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function actionFromRisk(score: number): IntegrityFlag["recommended_action"] {
  if (score >= 70) return "investigate";
  if (score >= 35) return "review";
  return "clear";
}

function computeRisk(similarityScore: number, aiSuspicionScore: number, baselineDeviationScore: number) {
  const weighted = similarityScore * 0.5 + aiSuspicionScore * 0.35 + baselineDeviationScore * 0.15;
  return clampScore(weighted);
}

function buildEvidenceGroups(params: {
  excerpt: string;
  overlap: {
    total_overlap: number;
    cited_overlap: number;
    uncited_overlap: number;
    internal_peer_overlap: number;
    external_source_overlap: number;
  };
  similarityScore: number;
}) {
  const uncitedMatches: EvidenceItem[] = [];
  const citedMatches: EvidenceItem[] = [];
  const peerMatches: EvidenceItem[] = [];
  const externalMatches: EvidenceItem[] = [];

  const excerpt = params.excerpt.trim();
  if (!excerpt) {
    return { uncitedMatches, citedMatc...