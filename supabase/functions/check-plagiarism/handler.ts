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
  /\(([A-Z][A-Za-z'`-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z'`-]+)?(?:\s+et al\.)?,\s*(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.\s*\d+(?:-\d+)?)?)\)/g;
const NARRATIVE_CITATION_PATTERN =
  /\b[A-Z][A-Za-z'`-]+(?:\s+(?:and|&)\s+[A-Z][A-Za-z'`-]+)?(?:\s+et al\.)?\s*\((?:19|20)\d{2}[a-z]?\)/g;
const URL_OR_DOI_PATTERN = /\b(?:https?:\/\/\S+|www\.\S+|doi:\s*\S+|10\.\d{4,9}\/-._;()\/:A-Z0-9+)\b/gi;
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

function preprocessSubmissionText(text: string) {
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
    return { uncitedMatches, citedMatches, peerMatches, externalMatches };
  }

  if (params.overlap.uncited_overlap > 0) {
    uncitedMatches.push(buildFallbackEvidenceItem("Uncited overlap", excerpt, params.overlap.uncited_overlap));
  }
  if (params.overlap.cited_overlap > 0) {
    citedMatches.push(buildFallbackEvidenceItem("Cited overlap", excerpt, params.overlap.cited_overlap));
  }
  if (params.overlap.internal_peer_overlap > 0) {
    peerMatches.push(
      buildFallbackEvidenceItem("Internal peer overlap", excerpt, params.overlap.internal_peer_overlap),
    );
  }
  if (params.overlap.external_source_overlap > 0) {
    externalMatches.push(
      buildFallbackEvidenceItem("External overlap", excerpt, params.overlap.external_source_overlap),
    );
  }

  if (
    uncitedMatches.length === 0 &&
    citedMatches.length === 0 &&
    peerMatches.length === 0 &&
    externalMatches.length === 0 &&
    params.similarityScore > 0
  ) {
    peerMatches.push(buildFallbackEvidenceItem("Similarity overlap", excerpt, params.similarityScore));
  }

  return { uncitedMatches, citedMatches, peerMatches, externalMatches };
}

function mergeEvidenceGroups(groups: Array<ReturnType<typeof buildEvidenceGroups>>) {
  const dedupe = (items: EvidenceItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.label}:${collapseWhitespace(item.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  };

  return {
    uncitedMatches: dedupe(groups.flatMap((group) => group.uncitedMatches)),
    citedMatches: dedupe(groups.flatMap((group) => group.citedMatches)),
    peerMatches: dedupe(groups.flatMap((group) => group.peerMatches)),
    externalMatches: dedupe(groups.flatMap((group) => group.externalMatches)),
  };
}

function normalizeMatchedExcerpt(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 500);
}

function normalizeReason(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeEvidenceSummary(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isRecoverablePersistenceError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "42P01" ||
    (typeof candidate.message === "string" && candidate.message.toLowerCase().includes("does not exist"));
}

function buildSimilarityEvidenceSummary(params: {
  similarityScore: number;
  overlap: {
    total_overlap: number;
    cited_overlap: number;
    uncited_overlap: number;
    internal_peer_overlap: number;
    external_source_overlap: number;
    reference_section_overlap?: number;
    heavy_source_reliance?: boolean;
  };
  classification: string;
}) {
  const parts: string[] = [];

  if (params.overlap.uncited_overlap > 0) {
    parts.push(`uncited overlap ${params.overlap.uncited_overlap}%`);
  }
  if (params.overlap.cited_overlap > 0) {
    parts.push(`cited material ${params.overlap.cited_overlap}%`);
  }
  if (params.overlap.internal_peer_overlap > 0) {
    parts.push(`internal overlap ${params.overlap.internal_peer_overlap}%`);
  }
  if (params.overlap.external_source_overlap > 0) {
    parts.push(`external overlap ${params.overlap.external_source_overlap}%`);
  }
  if ((params.overlap.reference_section_overlap || 0) > 0) {
    parts.push(`reference overlap ${params.overlap.reference_section_overlap}%`);
  }
  if (params.overlap.heavy_source_reliance) {
    parts.push("heavy source reliance");
  }

  if (parts.length === 0) {
    return `Similarity signal ${params.similarityScore}%`;
  }

  return `Similarity signal ${params.similarityScore}% with ${parts.join(", ")}. Classification: ${params.classification}.`;
}

function buildWarningMessage(fileName: string, extractionError: string | null) {
  if (!extractionError) return null;
  return `${fileName}: ${extractionError}`;
}

async function fetchFileContent(params: {
  supabaseAdmin: AdminSupabaseClient;
  submission: SubmissionRow;
}) {
  const filePath = params.submission.file_url;
  const fileName = params.submission.file_name || "submission";
  const lowerFileName = fileName.toLowerCase();
  const codeLanguage = detectMossLanguage(lowerFileName);
  const fileType = lowerFileName.includes(".") ? lowerFileName.split(".").pop() || "unknown" : "unknown";

  if (!filePath) {
    return {
      plainText: "",
      fileType,
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: `No file URL available for ${fileName}.`,
      extractionQuality: null,
    };
  }

  const bucket = "submissions";
  const { data, error } = await params.supabaseAdmin.storage.from(bucket).download(filePath);

  if (error || !data) {
    return {
      plainText: "",
      fileType,
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: `We could not download ${fileName} for analysis.`,
      extractionQuality: null,
    };
  }

  if (codeLanguage) {
    const plainText = await data.text();
    const extractionQuality = assessExtractionQuality(plainText);
    return {
      plainText,
      fileType,
      mimeType: data.type || "text/plain",
      success: true,
      extractionWarning: null,
      extractionError: null,
      extractionQuality,
    };
  }

  const extraction = await extractSubmissionDocument({
    blob: data,
    fileName,
  });

  logDocumentExtractionResult({
    fileName,
    success: extraction.success,
    warning: extraction.warning,
    error: extraction.error,
  });

  return {
    plainText: extraction.text,
    fileType,
    mimeType: data.type || "application/octet-stream",
    success: extraction.success,
    extractionWarning: extraction.warning,
    extractionError: extraction.error,
    extractionQuality: extraction.text ? assessExtractionQuality(extraction.text) : null,
  };
}

function categorizeIntegrityWarnings(warnings: string[]) {
  const categories = {
    extraction: 0,
    persistence: 0,
    ai: 0,
    review: 0,
    other: 0,
  };

  for (const warning of warnings) {
    const normalized = warning.toLowerCase();
    if (normalized.includes("extract") || normalized.includes("readable text")) {
      categories.extraction += 1;
    } else if (normalized.includes("store") || normalized.includes("persist")) {
      categories.persistence += 1;
    } else if (normalized.includes("ai")) {
      categories.ai += 1;
    } else if (normalized.includes("review")) {
      categories.review += 1;
    } else {
      categories.other += 1;
    }
  }

  return categories;
}

export function createCheckPlagiarismHandler(deps: CheckPlagiarismHandlerDeps) {
  return async (req: Request): Promise<Response> => {
    const corsHeaders = deps.getCorsHeaders(req);
    if (!corsHeaders) return deps.createCorsForbiddenResponse();

    const startedAt = Date.now();

    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "Method not allowed");
      }

      const rawBody = await req.json().catch(() => null);
      const parsedRequest = CheckPlagiarismRequestSchema.safeParse(rawBody);
      if (!parsedRequest.success) {
        throw new HttpError(
          400,
          includeValidationDetails
            ? parsedRequest.error.flatten().formErrors.join("; ") || "Invalid request"
            : "Invalid request",
        );
      }

      const rateLimit = applyRateLimit(req, "check-plagiarism");
      if (!rateLimit.allowed) {
        return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSec);
      }

      const user = await deps.requireLecturer(req);
      const supabaseAdmin = deps.createAdminClient();
      const requestedSubmissionIds = [
        ...(parsedRequest.data.submissionId ? [parsedRequest.data.submissionId] : []),
        ...(parsedRequest.data.submissionIds || []),
      ];

      const { data: submissions, error: submissionsError } = await supabaseAdmin
        .from("submissions")
        .select("id, assignment_id, student_id, student_name, student_email, file_name, file_url")
        .in("id", requestedSubmissionIds);

      if (submissionsError) {
        throw submissionsError;
      }

      if (!submissions || submissions.length === 0) {
        throw new HttpError(404, "No matching submissions found");
      }

      const requestedAssignmentId = parsedRequest.data.assignmentId || submissions[0]?.assignment_id;
      if (!requestedAssignmentId) {
        throw new HttpError(400, "Assignment context is required");
      }

      const warnings: string[] = [];
      const providerMode = resolveIntegrityProviderMode(rawBody);
      const mossRunnerConfig = resolveMossRunnerConfig();

      const assignmentSubmissionsQuery = await supabaseAdmin
        .from("submissions")
        .select("id, assignment_id, student_id, student_name, student_email, file_name, file_url")
        .eq("assignment_id", requestedAssignmentId);

      if (assignmentSubmissionsQuery.error) {
        throw assignmentSubmissionsQuery.error;
      }

      const assignmentSubmissions = (assignmentSubmissionsQuery.data || []) as SubmissionRow[];
      if (assignmentSubmissions.length >= LARGE_COHORT_WARNING_THRESHOLD) {
        warnings.push(
          `This assignment has ${assignmentSubmissions.length} submissions. Integrity comparisons were limited to keep the check responsive.`,
        );
      }

      const submissionsById = new Map(assignmentSubmissions.map((submission) => [submission.id, submission]));
      const submissionsInScope = requestedSubmissionIds
        .map((submissionId) => submissionsById.get(submissionId))
        .filter((submission): submission is SubmissionRow => Boolean(submission));

      const extractionResults = await mapWithConcurrency(submissionsInScope, EXTRACTION_CONCURRENCY, async (submission) => {
        const result = await fetchFileContent({
          supabaseAdmin,
          submission,
        });
        const extractionWarning = buildWarningMessage(submission.file_name || "submission", result.extractionError);
        if (extractionWarning) warnings.push(extractionWarning);
        if (!result.plainText.trim()) {
          warnings.push(`No readable text extracted for ${submission.file_name || "submission"}; similarity analysis may be less reliable.`);
        }
        return [submission.id, result] as const;
      });

      const contentMap = new Map(extractionResults);
      const processedContentMap = new Map(
        extractionResults.map(([submissionId, content]) => [submissionId, preprocessSubmissionText(content.plainText)]),
      );

      const providerSubmissions = assignmentSubmissions.map(toProviderSubmission);
      const internalComparisonPairs = buildInternalComparisonPairs({
        requestedSubmissionIds,
        submissions: providerSubmissions,
        maxSubmissions: MAX_INTERNAL_COMPARISON_SUBMISSIONS,
      });

      const internalComparableSubmissions = assignmentSubmissions.filter((submission) => {
        const content = contentMap.get(submission.id);
        return content ? supportsInternalTextSimilarity(content) : false;
      });

      const internalFindings = providerMode === "llm_legacy"
        ? []
        : buildInternalSimilarityFlagCandidates({
            requestedSubmissionIds,
            submissions: internalComparableSubmissions,
            processedContentBySubmissionId: processedContentMap,
            extractionContentBySubmissionId: contentMap,
          });

      const mossFindings = mossRunnerConfig
        ? await runMossSimilarityComparisons({
            config: mossRunnerConfig,
            assignmentId: requestedAssignmentId,
            requestedSubmissionIds,
            submissions: assignmentSubmissions,
            contentBySubmissionId: contentMap,
          })
        : [];

      const contentForLegacy = submissionsInScope.map((submission) => ({
        submission,
        content: contentMap.get(submission.id)?.plainText || "",
        processed: processedContentMap.get(submission.id) || preprocessSubmissionText(""),
      }));

      const llmFlags: IntegrityFlag[] = [];
      const aiBySubmission = new Map<string, number>();
      const similarityBySubmission = new Map<string, number>();

      if (providerMode !== "internal_text_similarity") {
        for (const pair of internalComparisonPairs) {
          const first = contentForLegacy.find((item) => item.submission.id === pair.left.id);
          const second = contentForLegacy.find((item) => item.submission.id === pair.right.id);
          if (!first || !second) continue;

          const similarityResult = analyzeTextSimilarity(first.content, second.content);
          const overlap = deriveCitationAwareOverlap({
            baseSimilarity: similarityResult.similarityScore,
            excerpt: similarityResult.matchExcerpt,
            submissionA: first.processed,
            submissionB: second.processed,
            provided: similarityResult.metadata,
            isPeerMatch: true,
          });

          const similarityScore = overlap.effectiveSimilarity;
          const aiSuspicionScore = 0;
          const baselineDeviationScore = 0;
          const totalRiskScore = computeRisk(similarityScore, aiSuspicionScore, baselineDeviationScore);
          const severity = severityFromRisk(totalRiskScore);
          const recommendedAction = actionFromRisk(totalRiskScore);
          const normalizedScores = normalizeScoresByContext(
            similarityScore,
            aiSuspicionScore,
            severity,
            "similarity",
            recommendedAction,
          );
          const evidenceGroups = buildEvidenceGroups({
            excerpt: similarityResult.matchExcerpt,
            overlap: overlap.overlap,
            similarityScore: normalizedScores.similarityScore,
          });

          const reason = normalizeArtifactDrivenReason({
            reason: overlap.overlap.uncited_overlap > 0
              ? "High similarity in code structure and logic."
              : "Similarity detected for lecturer review.",
            evidenceSummary: buildSimilarityEvidenceSummary({
              similarityScore: normalizedScores.similarityScore,
              overlap: overlap.overlap,
              classification: overlap.classification,
            }),
            totalRisk: totalRiskScore,
            overlap: overlap.overlap,
          });

          llmFlags.push({
            student_a: pair.left.student_name || pair.left.student_email || "Student A",
            student_b: pair.right.student_name || pair.right.student_email || "Student B",
            submission_a_id: pair.left.id,
            submission_b_id: pair.right.id,
            similarity_score: normalizedScores.similarityScore,
            ai_suspicion_score: normalizedScores.aiSuspicionScore,
            baseline_deviation_score: baselineDeviationScore,
            total_risk_score: totalRiskScore,
            reason,
            evidence_summary: buildSimilarityEvidenceSummary({
              similarityScore: normalizedScores.similarityScore,
              overlap: overlap.overlap,
              classification: overlap.classification,
            }),
            matched_excerpt: normalizeMatchedExcerpt(similarityResult.matchExcerpt),
            recommended_action: recommendedAction,
            integrity_type: "similarity",
            severity,
            overlap_analysis: overlap.overlap,
            evidence_groups: evidenceGroups,
          });
        }
      }

      const mergedFlags = [...llmFlags];
      const summaryBase = mergedFlags.length > 0 || internalFindings.length > 0 || mossFindings.length > 0
        ? "Multiple submissions show substantial similarity, suggesting potential academic integrity issues."
        : "No AI-writing suspicion detected.";
      const summary = summaryBase;

      for (const flag of mergedFlags) {
        aiBySubmission.set(flag.submission_a_id, Math.max(flag.ai_suspicion_score, aiBySubmission.get(flag.submission_a_id) || 0));
        similarityBySubmission.set(
          flag.submission_a_id,
          Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_a_id) || 0),
        );
        if (flag.submission_b_id && flag.submission_b_id !== flag.submission_a_id) {
          similarityBySubmission.set(
            flag.submission_b_id,
            Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_b_id) || 0),
          );
        }
      }

      const syntheticFlags: IntegrityFlag[] = [];
      const profileUpserts: Array<Record<string, unknown>> = [];
      const snapshots = new Map<
        string,
        {
          totalScore: number;
          aiWritingScore: number;
          similarityScore: number;
          overlapBreakdown: {
            totalOverlap: number;
            citedOverlap: number;
            uncitedOverlap: number;
            internalPeerOverlap: number;
            externalSourceOverlap: number;
          };
          baselineDeviationScore: number;
          analysisLimited: boolean;
          limitations: string[];
          riskLevel: "high" | "medium" | "low";
          evidence: {
            aiWriting: Array<{ label: string; value: string; score: number }>;
            similarity: Array<{ label: string; value: string; score: number }>;
            baselineDeviation: Array<{ label: string; value: string; score: number }>;
            uncitedMatches: EvidenceItem[];
            citedMatches: EvidenceItem[];
            peerMatches: EvidenceItem[];
            externalMatches: EvidenceItem[];
          };
          flags: string[];
        }
      >();

      const ensureSnapshot = (submission: SubmissionRow) => {
        const existing = snapshots.get(submission.id);
        if (existing) return existing;
        const next = {
          totalScore: 0,
          aiWritingScore: 0,
          similarityScore: 0,
          overlapBreakdown: {
            totalOverlap: 0,
            citedOverlap: 0,
            uncitedOverlap: 0,
            internalPeerOverlap: 0,
            externalSourceOverlap: 0,
          },
          baselineDeviationScore: 0,
          analysisLimited: false,
          limitations: [] as string[],
          riskLevel: "low" as const,
          evidence: {
            aiWriting: [] as Array<{ label: string; value: string; score: number }>,
            similarity: [] as Array<{ label: string; value: string; score: number }>,
            baselineDeviation: [] as Array<{ label: string; value: string; score: number }>,
            uncitedMatches: [] as EvidenceItem[],
            citedMatches: [] as EvidenceItem[],
            peerMatches: [] as EvidenceItem[],
            externalMatches: [] as EvidenceItem[],
          },
          flags: [] as string[],
        };
        snapshots.set(submission.id, next);
        return next;
      };

      const profileMap = new Map<string, StoredWritingProfile>();
      const gradeMap = new Map<string, number>();
      const submissionIdsByStudent = new Map<string, string[]>();

      for (const submission of submissionsInScope) {
        if (submission.student_id) {
          const existing = submissionIdsByStudent.get(submission.student_id) || [];
          existing.push(submission.id);
          submissionIdsByStudent.set(submission.student_id, existing);
        }
      }

      for (const submission of submissionsInScope) {
        const content = contentMap.get(submission.id) || {
          plainText: "",
          fileType: "unsupported",
          mimeType: "application/octet-stream",
          success: false,
          extractionWarning: null,
          extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
          extractionQuality: null,
        };
        const processed = processedContentMap.get(submission.id) || preprocessSubmissionText(content.plainText);
        const metrics: WritingProfileMetrics = computeWritingProfileMetrics(content.plainText);
        const baseline = submission.student_id ? profileMap.get(submission.student_id) : null;
        const currentGrade = gradeMap.get(submission.id) ?? null;
        const previousAverage =
          submission.student_id && submissionIdsByStudent.has(submission.student_id)
            ? (() => {
                const previousScores = (submissionIdsByStudent.get(submission.student_id) || [])
                  .filter((id) => id !== submission.id)
                  .map((id) => gradeMap.get(id))
                  .filter((score): score is number => typeof score === "number");
                return previousScores.length > 0
                  ? previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length
                  : null;
              })()
            : null;

        const baselineDeviation = computeBaselineDeviation(baseline, metrics, {
          previousAverage,
          currentGrade,
        });
        const similarityScore = similarityBySubmission.get(submission.id) || 0;
        const aiScore = aiBySubmission.get(submission.id) || 0;
        const totalRiskScore = computeRisk(similarityScore, aiScore, baselineDeviation.score);
        const snapshot = ensureSnapshot(submission);
        snapshot.totalScore = Math.max(snapshot.totalScore, totalRiskScore);
        snapshot.aiWritingScore = Math.max(snapshot.aiWritingScore, aiScore);
        snapshot.similarityScore = Math.max(snapshot.similarityScore, similarityScore);
        snapshot.baselineDeviationScore = Math.max(snapshot.baselineDeviationScore, baselineDeviation.score);
        snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
          ? "high"
          : severityFromRisk(snapshot.totalScore) === "medium"
            ? "medium"
            : "low";

        if (baselineDeviation.reasons.length > 0) {
          snapshot.evidence.baselineDeviation.push({
            label: "Writing profile deviation",
            value: baselineDeviation.reasons.join(" "),
            score: baselineDeviation.score,
          });
          snapshot.flags.push("baseline deviation");
        }

        if (processed.hasReferenceSection) {
          snapshot.flags.push("reference section excluded from overlap scoring");
        }

        if (processed.extractionQuality && !processed.extractionQuality.isUsable) {
          snapshot.analysisLimited = true;
          snapshot.limitations = Array.from(
            new Set([...snapshot.limitations, ...processed.extractionQuality.reasons]),
          );
          snapshot.evidence.similarity.push({
            label: "Low-quality PDF extraction",
            value: processed.extractionQuality.reasons.join(" "),
            score: 0,
          });
          snapshot.flags.push("low-quality text extraction");
        }

        if (processed.quoteShare >= 0.2) {
          snapshot.evidence.citedMatches.push({
            label: "Heavy reliance on sources",
            value: `${Math.round(processed.quoteShare * 100)}% of the scored main body appears inside quoted blocks or close to citations. Low plagiarism risk, but lecturer review may still be useful.`,
            score: Math.round(processed.quoteShare * 100),
          });
          snapshot.flags.push("heavy reliance on sources");
        }

        if (submission.student_id && metrics.word_count >= 80 && totalRiskScore < 45) {
          const merged = mergeWritingProfile(baseline, metrics);
          profileUpserts.push({
            student_id: submission.student_id,
            average_sentence_complexity: merged.average_sentence_complexity,
            lexile_level: merged.lexile_level,
            error_fingerprint: merged.error_fingerprint,
            vocabulary_breadth: merged.vocabulary_breadth,
            sample_count: merged.sample_count,
            baseline_vector: {
              word_count: merged.word_count,
              sentence_count: merged.sentence_count,
              average_words_per_sentence: merged.average_words_per_sentence,
            },
          });
        }

        if (baselineDeviation.score >= 45) {
          syntheticFlags.push({
            student_a: submission.student_name || submission.student_email || "Student",
            student_b: "Writing baseline",
            submission_a_id: submission.id,
            submission_b_id: submission.id,
            similarity_score: similarityScore,
            ai_suspicion_score: aiScore,
            baseline_deviation_score: baselineDeviation.score,
            total_risk_score: totalRiskScore,
            reason: baselineDeviation.reasons[0] || "The submission deviates materially from the student's stored writing profile.",
            evidence_summary: baselineDeviation.reasons.join(" "),
            matched_excerpt: content.plainText.substring(0, 240),
            recommended_action: actionFromRisk(totalRiskScore),
            integrity_type: baselineDeviation.score > 0 && (similarityScore > 0 || aiScore > 0) ? "mixed" : "baseline-deviation",
            severity: severityFromRisk(totalRiskScore),
          });
        }
      }

      for (const flag of mergedFlags) {
        const submission = submissionsInScope.find((item) => item.id === flag.submission_a_id);
        if (!submission) continue;
        const snapshot = ensureSnapshot(submission);
        snapshot.totalScore = Math.max(snapshot.totalScore, flag.total_risk_score);
        snapshot.aiWritingScore = Math.max(snapshot.aiWritingScore, flag.ai_suspicion_score);
        snapshot.similarityScore = Math.max(snapshot.similarityScore, flag.similarity_score);
        snapshot.baselineDeviationScore = Math.max(snapshot.baselineDeviationScore, flag.baseline_deviation_score);
        snapshot.overlapBreakdown.totalOverlap = Math.max(
          snapshot.overlapBreakdown.totalOverlap,
          flag.overlap_analysis?.total_overlap || flag.similarity_score,
        );
        snapshot.overlapBreakdown.citedOverlap = Math.max(
          snapshot.overlapBreakdown.citedOverlap,
          flag.overlap_analysis?.cited_overlap || 0,
        );
        snapshot.overlapBreakdown.uncitedOverlap = Math.max(
          snapshot.overlapBreakdown.uncitedOverlap,
          flag.overlap_analysis?.uncited_overlap || 0,
        );
        snapshot.overlapBreakdown.internalPeerOverlap = Math.max(
          snapshot.overlapBreakdown.internalPeerOverlap,
          flag.overlap_analysis?.internal_peer_overlap || 0,
        );
        snapshot.overlapBreakdown.externalSourceOverlap = Math.max(
          snapshot.overlapBreakdown.externalSourceOverlap,
          flag.overlap_analysis?.external_source_overlap || 0,
        );
        snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
          ? "high"
          : severityFromRisk(snapshot.totalScore) === "medium"
            ? "medium"
            : "low";

        if (flag.ai_suspicion_score > 0) {
          snapshot.evidence.aiWriting.push({
            label: "AI-writing risk",
            value: flag.evidence_summary || flag.reason,
            score: flag.ai_suspicion_score,
          });
          snapshot.flags.push("ai writing suspicion");
        }

        if (flag.similarity_score > 0) {
          snapshot.evidence.similarity.push({
            label: (flag.overlap_analysis?.uncited_overlap || 0) > 0
              ? "Uncited overlap"
              : (flag.overlap_analysis?.cited_overlap || 0) > 0
                ? "Cited material"
                : "Similarity overlap",
            value: flag.reason,
            score: flag.similarity_score,
          });
          snapshot.flags.push(
            (flag.overlap_analysis?.uncited_overlap || 0) > 0
              ? "uncited overlap"
              : (flag.overlap_analysis?.cited_overlap || 0) > 0
                ? "cited material"
                : "similarity overlap",
          );
        }

        for (const evidence of flag.evidence_groups?.uncited_matches || []) {
          snapshot.evidence.uncitedMatches.push(evidence);
        }
        for (const evidence of flag.evidence_groups?.cited_matches || []) {
          snapshot.evidence.citedMatches.push(evidence);
        }
        for (const evidence of flag.evidence_groups?.peer_matches || []) {
          snapshot.evidence.peerMatches.push(evidence);
        }
        for (const evidence of flag.evidence_groups?.external_matches || []) {
          snapshot.evidence.externalMatches.push(evidence);
        }
      }

      const allFlags = [...mergedFlags, ...syntheticFlags].filter((flag, index, array) => {
        return (
          array.findIndex(
            (item) =>
              item.submission_a_id === flag.submission_a_id &&
              item.submission_b_id === flag.submission_b_id &&
              item.reason === flag.reason,
          ) === index
        );
      });

      const { data: existingReviews, error: reviewsError } = await supabaseAdmin
        .from("academic_integrity_reviews")
        .select("submission_id, decision, lecturer_note, updated_at")
        .in("submission_id", submissionsInScope.map((submission) => submission.id))
        .eq("lecturer_id", user.id);

      if (reviewsError) {
        if (isRecoverablePersistenceError(reviewsError)) {
          logWarn("academic_integrity_reviews unavailable, continuing without persisted reviews", {
            function: "check-plagiarism",
          });
        } else {
          logError("academic_integrity_reviews query failed", reviewsError, {
            function: "check-plagiarism",
            assignmentId: requestedAssignmentId,
          });
          warnings.push("Existing integrity review history could not be loaded, but analysis completed.");
        }
      }

      const existingReviewMap = new Map(
        ((existingReviews || []) as Array<Record<string, unknown>>).map((review) => [String(review.submission_id), review]),
      );

      if (requestedAssignmentId && internalFindings.length > 0) {
        await upsertIntegrityFindings({
          supabaseAdmin,
          assignmentId: requestedAssignmentId,
          findings: internalFindings,
          providerLabel: "internal_text_similarity",
          startLogMessage: "internal_similarity_upsert_started",
          successLogMessage: "internal_similarity_upsert_completed",
          errorLogMessage: "internal_similarity_upsert_failed",
          warningMessage: "Internal similarity evidence could not be stored, but analysis completed.",
          warnings,
          requireComparedSubmissionId: true,
        });
      }

      if (requestedAssignmentId && mossFindings.length > 0) {
        await upsertIntegrityFindings({
          supabaseAdmin,
          assignmentId: requestedAssignmentId,
          findings: mossFindings,
          providerLabel: "moss",
          startLogMessage: "moss_similarity_upsert_started",
          successLogMessage: "moss_similarity_upsert_completed",
          errorLogMessage: "moss_similarity_upsert_failed",
          warningMessage: "MOSS similarity evidence could not be stored, but analysis completed.",
          warnings,
          requireComparedSubmissionId: true,
        });
      }

      const reviewUpserts = submissionsInScope
        .map((submission) => {
          const snapshot = snapshots.get(submission.id) || null;
          const existingReview = existingReviewMap.get(submission.id);
          if (!snapshot && !existingReview) return null;

          const notePayload = (() => {
            if (existingReview?.lecturer_note && typeof existingReview.lecturer_note === "string") {
              try {
                const parsed = ExistingReviewNoteSchema.safeParse(JSON.parse(existingReview.lecturer_note));
                return {
                  latestNote: parsed.success ? parsed.data.latestNote : "",
                  history: parsed.success ? parsed.data.history : [],
                };
              } catch {
                return { latestNote: "", history: [] };
              }
            }
            return { latestNote: "", history: [] };
          })();

          return {
            submission_id: submission.id,
            lecturer_id: user.id,
            review_type:
              snapshot && snapshot.baselineDeviationScore > 0 && snapshot.aiWritingScore === 0 && snapshot.similarityScore === 0
                ? "baseline-deviation"
                : snapshot && snapshot.aiWritingScore > 0 && snapshot.similarityScore > 0
                  ? "mixed"
                  : snapshot && snapshot.aiWritingScore > 0
                    ? "ai-writing-suspicion"
                    : "similarity-plagiarism-suspicion",
            decision: String(existingReview?.decision || "pending"),
            evidence_summary: snapshot
              ? [
                  ...snapshot.evidence.aiWriting.map((entry) => `${entry.label}: ${entry.value}`),
                  ...snapshot.evidence.similarity.map((entry) => `${entry.label}: ${entry.value}`),
                  ...snapshot.evidence.uncitedMatches.map((entry) => `${entry.label}: ${entry.value}`),
                  ...snapshot.evidence.citedMatches.map((entry) => `${entry.label}: ${entry.value}`),
                  ...snapshot.evidence.peerMatches.map((entry) => `${entry.label}: ${entry.value}`),
                  ...snapshot.evidence.externalMatches.map((entry) => `${entry.label}: ${entry.value}`),
                  ...snapshot.evidence.baselineDeviation.map((entry) => `${entry.label}: ${entry.value}`),
                ]
                  .slice(0, 8)
                  .join("\n\n") || null
              : null,
            lecturer_note: JSON.stringify({
              latestNote: notePayload.latestNote,
              history: notePayload.history,
              integritySnapshot: snapshot,
            }),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (reviewUpserts.length > 0) {
        const { error: persistError } = await supabaseAdmin
          .from("academic_integrity_reviews")
          .upsert(reviewUpserts, { onConflict: "submission_id,lecturer_id" });
        if (persistError) {
          if (isRecoverablePersistenceError(persistError)) {
            logWarn("Failed to persist academic integrity reviews, returning analysis without persistence", {
              function: "check-plagiarism",
            });
          } else {
            logError("academic_integrity_reviews upsert failed", persistError, {
              function: "check-plagiarism",
              assignmentId: requestedAssignmentId,
              reviewCount: reviewUpserts.length,
            });
          }
          warnings.push("Integrity review records could not be stored, but analysis completed.");
        }
      }

      if (profileUpserts.length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from("student_writing_profiles")
          .upsert(profileUpserts, { onConflict: "student_id" });
        if (profileError) {
          logError("student_writing_profiles upsert failed", profileError, {
            function: "check-plagiarism",
            assignmentId: requestedAssignmentId,
            profileCount: profileUpserts.length,
          });
          warnings.push("Writing profile history could not be updated, but analysis completed.");
        }
      }

      const thresholdCrossingFlags = allFlags.filter(
        (flag) =>
          flag.similarity_score >= MIN_INTEGRITY_FLAG_SCORE ||
          flag.ai_suspicion_score >= MIN_INTEGRITY_FLAG_SCORE ||
          flag.baseline_deviation_score >= MIN_INTEGRITY_FLAG_SCORE ||
          flag.total_risk_score >= MIN_INTEGRITY_FLAG_SCORE,
      );

      const finalSummary =
        thresholdCrossingFlags.length > 0
          ? `${summary} ${thresholdCrossingFlags.length} submission(s) crossed one or more integrity risk thresholds.`
          : `${summary} No submissions crossed the current integrity thresholds.`;

      logInfo("check-plagiarism completed", {
        assignmentId: requestedAssignmentId,
        submissionCount: submissionsInScope.length,
        flags: thresholdCrossingFlags.length,
        warnings: warnings.length,
        durationMs: Date.now() - startedAt,
      });
      if (warnings.length > 0) {
        const analysisLimitedSubmissionCount = Array.from(snapshots.values()).filter(
          (snapshot) => snapshot.analysisLimited,
        ).length;
        logWarn("check-plagiarism completed_with_limitations", {
          assignmentId: requestedAssignmentId,
          submissionCount: submissionsInScope.length,
          flags: thresholdCrossingFlags.length,
          warningCount: warnings.length,
          analysisLimitedSubmissionCount,
          warningCategories: categorizeIntegrityWarnings(warnings),
        });
      }

      return new Response(JSON.stringify({ flags: allFlags, summary: finalSummary, warnings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      logError("check-plagiarism error", e);
      return deps.jsonError(e, corsHeaders);
    }
  };
}
