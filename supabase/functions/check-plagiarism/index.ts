import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import {
  DOCUMENT_EXTRACTION_ERROR_MESSAGE,
  extractSubmissionDocument,
  logDocumentExtractionResult,
} from "../_shared/document-extraction.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";
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

const CheckPlagiarismRequestSchema = z
  .object({
    submissionId: z.string().uuid().optional(),
    submissionIds: z.array(z.string().uuid()).max(50).optional(),
    assignmentId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.submissionId) || Boolean(value.submissionIds?.length), {
    message: "At least one of submissionId or submissionIds is required",
    path: ["submissionIds"],
  });
const includeValidationDetails = Deno.env.get("ENV") === "development";

const MAX_SINGLE_TEXT_CHARS = 12000;
const MAX_MULTI_TEXT_CHARS = 3500;
const OPENAI_RETRY_ATTEMPTS = 2;
const MIN_INTEGRITY_FLAG_SCORE = 25;
const INTERNAL_SIMILARITY_MIN_WORDS = 50;

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

type IntegrityFindingInsert = {
  provider: string;
  assignment_id: string;
  submission_id: string;
  compared_submission_id: string | null;
  similarity_score: number;
  severity: string;
  evidence_summary: string;
  matched_phrases: string[];
  raw_metadata: Record<string, unknown>;
  analysis_limited: boolean;
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
const URL_OR_DOI_PATTERN = /\b(?:https?:\/\/\S+|www\.\S+|doi:\s*\S+|10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi;
const QUOTED_BLOCK_PATTERN = /["“][^"”]{20,}["”]/g;
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
  const envProvider = Deno.env.get("INTEGRITY_PROVIDER_MODE")?.trim().toLowerCase() || "";
  if (envProvider === "llm_legacy" || envProvider === "internal_text_similarity" || envProvider === "both") {
    return envProvider;
  }
  return "both";
}

function supportsInternalTextSimilarity(content: {
  plainText: string;
  fileType: string;
  success: boolean;
  extractionError: string | null;
}) {
  if (!content.success || content.extractionError) return false;
  if (!["pdf", "docx", "txt"].includes(content.fileType)) return false;
  return countWords(content.plainText) >= INTERNAL_SIMILARITY_MIN_WORDS;
}

function buildIntegrityFindingInsert(finding: IntegrityProviderFinding): IntegrityFindingInsert {
  return {
    provider: finding.provider,
    assignment_id: finding.assignment_id,
    submission_id: finding.submission_id,
    compared_submission_id: finding.compared_submission_id ?? null,
    similarity_score: finding.similarity_score,
    severity: finding.severity,
    evidence_summary: finding.evidence_summary,
    matched_phrases: finding.matched_phrases,
    raw_metadata: finding.raw_metadata,
    analysis_limited: finding.analysis_limited,
  };
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
  if (/^["“].*["”]$/.test(excerpt.trim())) return true;

  const candidates = [excerpt.trim(), excerpt.trim().slice(0, 120), excerpt.trim().slice(0, 80)].filter(
    (candidate) => candidate.length >= 20,
  );

  for (const candidate of candidates) {
    const index = text.indexOf(candidate);
    if (index === -1) continue;

    const before = text.slice(Math.max(0, index - 120), index);
    const after = text.slice(index + candidate.length, index + candidate.length + 140);
    if (before.trimEnd().endsWith(`"`) || after.trimStart().startsWith(`"`)) return true;
    const quoteLead = before.trimEnd().endsWith(`"`) || before.trimEnd().endsWith(`“`);
    const quoteTail = after.trimStart().startsWith(`"`) || after.trimStart().startsWith(`”`);
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
  }

  if (integrityType === "ai-writing" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedAi = enforceScoreBand(normalizedAi, 75, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedAi = enforceScoreBand(normalizedAi, 45, 74);
    } else {
      normalizedAi = enforceScoreBand(normalizedAi, 0, 44);
    }
  }

  return {
    similarity: normalizedSimilarity,
    ai: normalizedAi,
  };
}

function computeRisk(similarity: number, aiSuspicion: number, baselineDeviation: number) {
  return Math.round(similarity * 0.4 + aiSuspicion * 0.3 + baselineDeviation * 0.3);
}

function severityFromRisk(score: number): IntegrityFlag["severity"] {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function actionFromRisk(score: number): IntegrityFlag["recommended_action"] {
  if (score >= 80) return "investigate";
  if (score >= 45) return "review";
  return "clear";
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[truncated]`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverablePersistenceError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "42703" ||
    candidate.code === "23514" ||
    candidate.message?.toLowerCase().includes("does not exist") === true ||
    candidate.message?.toLowerCase().includes("check constraint") === true
  );
}

async function fetchFileContent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sub: { file_url?: string; file_name?: string | null },
): Promise<{
  plainText: string;
  fileType: string;
  mimeType: string;
  success: boolean;
  extractionWarning: string | null;
  extractionError: string | null;
  extractionQuality: ReturnType<typeof assessExtractionQuality> | null;
}> {
  if (!sub.file_url) {
    return {
      plainText: "",
      fileType: "unsupported",
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQuality: null,
    };
  }
  try {
    const { data, error } = await supabaseAdmin.storage.from("submissions").download(sub.file_url);
    if (error || !data) {
      return {
        plainText: "",
        fileType: "unsupported",
        mimeType: "application/octet-stream",
        success: false,
        extractionWarning: null,
        extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
        extractionQuality: null,
      };
    }

    const extraction = await extractSubmissionDocument({
      fileName: sub.file_name,
      mimeType: data.type,
      fileData: data,
    });

    logDocumentExtractionResult("check-plagiarism", extraction);

    const cleaned = truncateText(extraction.extractedText, MAX_SINGLE_TEXT_CHARS);
    return {
      plainText: cleaned,
      fileType: extraction.fileType,
      mimeType: extraction.mimeType,
      success: extraction.success,
      extractionWarning: extraction.extractionWarning,
      extractionError: extraction.extractionError,
      extractionQuality: extraction.success ? assessExtractionQuality(cleaned) : null,
    };
  } catch {
    return {
      plainText: "",
      fileType: "unsupported",
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQuality: null,
    };
  }
}

async function createIntegrityResponseWithRetry(body: Record<string, unknown>) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= OPENAI_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await createResponse(body);
    } catch (error) {
      lastError = error;
      logWarn("check-plagiarism OpenAI attempt failed", {
        attempt,
      });
      if (attempt < OPENAI_RETRY_ATTEMPTS) {
        await sleep(250 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Integrity analysis request failed");
}

function normalizeFlags(
  flags: unknown,
  submissions: SubmissionRow[],
  processedContent: Map<string, ProcessedSubmissionText>,
): IntegrityFlag[] {
  if (!Array.isArray(flags)) return [];

  return flags
    .map((flag) => {
      if (!flag || typeof flag !== "object") return null;
      const candidate = flag as Record<string, unknown>;
      const submissionAId = typeof candidate.submission_a_id === "string" ? candidate.submission_a_id : "";
      const submissionBId =
        typeof candidate.submission_b_id === "string" && candidate.submission_b_id
          ? candidate.submission_b_id
          : submissionAId;
      const submissionA = submissions.find((entry) => entry.id === submissionAId);
      const submissionB = submissions.find((entry) => entry.id === submissionBId);
      const severity = normalizeSeverity(candidate.severity);
      const recommendedAction = normalizeAction(candidate.recommended_action);
      const integrityType = normalizeType(candidate.integrity_type);
      const normalizedScores = normalizeScoresByContext(
        clampScore(candidate.similarity_score),
        clampScore(candidate.ai_suspicion_score),
        severity,
        integrityType,
        recommendedAction,
      );
      const overlap = deriveCitationAwareOverlap({
        baseSimilarity: normalizedScores.similarity,
        excerpt: typeof candidate.matched_excerpt === "string" ? candidate.matched_excerpt.trim() : "",
        submissionA: processedContent.get(submissionAId),
        submissionB: processedContent.get(submissionBId),
        provided: candidate.overlap_analysis && typeof candidate.overlap_analysis === "object"
          ? (candidate.overlap_analysis as Record<string, unknown>)
          : undefined,
        isPeerMatch: submissionAId !== submissionBId,
      });
      const baselineDeviationScore = clampScore(candidate.baseline_deviation_score);
      const totalRisk = computeRisk(overlap.effectiveSimilarity, normalizedScores.ai, baselineDeviationScore);
      const matchedExcerpt = typeof candidate.matched_excerpt === "string" ? candidate.matched_excerpt.trim() : "";
      const rawReason =
        typeof candidate.reason === "string" && candidate.reason.trim()
          ? candidate.reason.trim()
          : "Potential integrity issue detected.";
      const rawEvidenceSummary =
        typeof candidate.evidence_summary === "string" && candidate.evidence_summary.trim()
          ? candidate.evidence_summary.trim()
          : rawReason;
      const normalizedReason = normalizeArtifactDrivenReason({
        reason: rawReason,
        evidenceSummary: rawEvidenceSummary,
        totalRisk,
        overlap: overlap.overlap,
      });
      const baseEvidenceText =
        rawEvidenceSummary ||
        normalizedReason ||
        matchedExcerpt ||
        "Potential overlap detected.";
      const uncitedMatches = Array.isArray((candidate.evidence_groups as Record<string, unknown> | undefined)?.uncited_matches)
        ? ((candidate.evidence_groups as Record<string, unknown>).uncited_matches as EvidenceItem[])
        : overlap.classification === "uncited"
          ? [buildFallbackEvidenceItem("Uncited match", baseEvidenceText, overlap.overlap.uncited_overlap)]
          : [];
      const citedMatches = Array.isArray((candidate.evidence_groups as Record<string, unknown> | undefined)?.cited_matches)
        ? ((candidate.evidence_groups as Record<string, unknown>).cited_matches as EvidenceItem[])
        : overlap.classification === "cited" || overlap.overlap.cited_overlap > 0
          ? [
            buildFallbackEvidenceItem(
              overlap.overlap.heavy_source_reliance ? "Cited material with heavy reliance on sources" : "Cited material",
              baseEvidenceText,
              overlap.overlap.cited_overlap || Math.round(normalizedScores.similarity * 0.2),
            ),
          ]
          : [];
      const peerMatches = Array.isArray((candidate.evidence_groups as Record<string, unknown> | undefined)?.peer_matches)
        ? ((candidate.evidence_groups as Record<string, unknown>).peer_matches as EvidenceItem[])
        : submissionAId !== submissionBId
          ? [buildFallbackEvidenceItem("Peer overlap", baseEvidenceText, overlap.overlap.internal_peer_overlap)]
          : [];
      const externalMatches = Array.isArray((candidate.evidence_groups as Record<string, unknown> | undefined)?.external_matches)
        ? ((candidate.evidence_groups as Record<string, unknown>).external_matches as EvidenceItem[])
        : [];

      return {
        student_a:
          (typeof candidate.student_a === "string" && candidate.student_a.trim()) ||
          submissionA?.student_name ||
          submissionA?.student_email ||
          "Student A",
        student_b:
          (typeof candidate.student_b === "string" && candidate.student_b.trim()) ||
          submissionB?.student_name ||
          submissionB?.student_email ||
          (submissionAId === submissionBId ? "Writing profile" : "Student B"),
        submission_a_id: submissionAId,
        submission_b_id: submissionBId,
        similarity_score: overlap.effectiveSimilarity,
        ai_suspicion_score: normalizedScores.ai,
        baseline_deviation_score: baselineDeviationScore,
        total_risk_score: totalRisk,
        reason: normalizedReason,
        evidence_summary: rawEvidenceSummary,
        matched_excerpt: matchedExcerpt,
        recommended_action: actionFromRisk(totalRisk),
        integrity_type: integrityType,
        severity: severityFromRisk(totalRisk),
        overlap_analysis: overlap.overlap,
        evidence_groups: {
          uncited_matches: uncitedMatches,
          cited_matches: citedMatches,
          peer_matches: peerMatches,
          external_matches: externalMatches,
        },
      } satisfies IntegrityFlag;
    })
    .filter((flag): flag is IntegrityFlag => Boolean(flag))
    .filter(
      (flag) =>
        flag.similarity_score >= MIN_INTEGRITY_FLAG_SCORE ||
        flag.ai_suspicion_score >= MIN_INTEGRITY_FLAG_SCORE ||
        flag.baseline_deviation_score >= MIN_INTEGRITY_FLAG_SCORE ||
        flag.total_risk_score >= MIN_INTEGRITY_FLAG_SCORE,
    );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const methodError = requirePostMethod(req, corsHeaders);
  if (methodError) return methodError;

  try {
    const startedAt = Date.now();
    const { user } = await requireLecturer(req);
    const rateLimit = applyRateLimit(req, {
      scope: "check-plagiarism",
      limit: 5,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "check-plagiarism", identifierType: rateLimit.identifierType });
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
    const parsedRequest = CheckPlagiarismRequestSchema.safeParse({
      submissionId: typeof rawBody?.submissionId === "string" ? rawBody.submissionId : undefined,
      submissionIds: normalizedSubmissionIds,
      assignmentId:
        typeof rawBody?.assignmentId === "string"
          ? rawBody.assignmentId
          : rawBody?.assignment && typeof rawBody.assignment === "object" && typeof (rawBody.assignment as Record<string, unknown>).id === "string"
            ? (rawBody.assignment as Record<string, unknown>).id
            : undefined,
    });

    if (!parsedRequest.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          message: "Please provide a valid submission ID or list of submission IDs.",
          ...(includeValidationDetails ? { details: parsedRequest.error.issues } : {}),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const integrityModel = getModel("OPENAI_INTEGRITY_MODEL", "gpt-5.4-mini");
    const providerMode = resolveIntegrityProviderMode(rawBody);
    const requestedAssignmentId = parsedRequest.data.assignmentId ?? null;
    const requestedSubmissionIds = parsedRequest.data.submissionIds ?? (parsedRequest.data.submissionId ? [parsedRequest.data.submissionId] : []);

    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      return new Response(JSON.stringify({ flags: [], summary: "No submissions provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createAdminClient();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, lecturer_id, title, description")
      .eq("id", requestedAssignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error("Failed to load assignment");
    if (!assignment || assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, student_id, student_name, student_email, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) throw new Error("Failed to load submissions");
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }

    const isSingleMode = submissions.length === 1;
    const warnings: string[] = [];
    const contentMap = new Map<string, Awaited<ReturnType<typeof fetchFileContent>>>();
    const processedContentMap = new Map<string, ProcessedSubmissionText>();
    for (const sub of submissions) {
      const content = await fetchFileContent(supabaseAdmin, sub);
      contentMap.set(sub.id, content);
      const processed = preprocessSubmissionText(content.plainText);
      processed.extractionQuality = content.extractionQuality ?? undefined;
      processedContentMap.set(sub.id, processed);

      if (!content.success && content.extractionError) {
        warnings.push(`${sub.file_name || sub.id}: ${content.extractionError}`);
      } else if (content.extractionWarning) {
        warnings.push(`${sub.file_name || sub.id}: ${content.extractionWarning}`);
      }

      if (content.fileType === "pdf" && content.extractionQuality && !content.extractionQuality.isUsable) {
        warnings.push(
          `Low-quality PDF extraction for ${sub.file_name || sub.id}: ${content.extractionQuality.reasons.join(" ")} Word count ${content.extractionQuality.wordCount}, quality ${content.extractionQuality.qualityScore}/100.`,
        );
      }
    }

    const studentIds = submissions.map((submission) => submission.student_id).filter((value): value is string => Boolean(value));
    const { data: profileRows, error: profileRowsError } = studentIds.length > 0
      ? await supabaseAdmin
          .from("student_writing_profiles")
          .select("*")
          .in("student_id", studentIds)
      : { data: [], error: null };

    if (profileRowsError) {
      if (isRecoverablePersistenceError(profileRowsError)) {
        logWarn("student_writing_profiles unavailable, continuing without baseline persistence", {
          function: "check-plagiarism",
        });
      } else {
        throw profileRowsError;
      }
    }

    const profileMap = new Map<string, StoredWritingProfile>(
      ((profileRows || []) as Array<Record<string, unknown>>).map((row) => [
        String(row.student_id),
        {
          average_sentence_complexity: Number(row.average_sentence_complexity || 0),
          lexile_level: Number(row.lexile_level || 0),
          error_fingerprint: Array.isArray(row.error_fingerprint)
            ? row.error_fingerprint.filter((item): item is string => typeof item === "string")
            : [],
          vocabulary_breadth: Number(row.vocabulary_breadth || 0),
          word_count: Number((row.baseline_vector as Record<string, unknown> | null)?.word_count || 0),
          sentence_count: Number((row.baseline_vector as Record<string, unknown> | null)?.sentence_count || 0),
          average_words_per_sentence: Number(
            (row.baseline_vector as Record<string, unknown> | null)?.average_words_per_sentence || 0,
          ),
          sample_count: Number(row.sample_count || 0),
        },
      ]),
    );

    const { data: studentSubmissions } = studentIds.length > 0
      ? await supabaseAdmin.from("submissions").select("id, student_id").in("student_id", studentIds)
      : { data: [] };
    const allStudentSubmissionIds = (studentSubmissions || []).map((submission) => submission.id);
    const { data: gradeRows } = allStudentSubmissionIds.length > 0
      ? await supabaseAdmin.from("grades").select("submission_id, ai_score, final_score").in("submission_id", allStudentSubmissionIds)
      : { data: [] };
    const gradeMap = new Map<string, number>(
      (gradeRows || [])
        .filter((row) => row.final_score != null || row.ai_score != null)
        .map((row) => [row.submission_id, Number(row.final_score ?? row.ai_score)]),
    );

    const submissionIdsByStudent = new Map<string, string[]>();
    for (const row of studentSubmissions || []) {
      if (!row.student_id) continue;
      const list = submissionIdsByStudent.get(row.student_id) || [];
      list.push(row.id);
      submissionIdsByStudent.set(row.student_id, list);
    }

    const systemPrompt = isSingleMode
      ? `You are an academic integrity detection assistant.

Your output is a risk indicator, never a verdict.

Assess AI-writing suspicion using multiple indicators:
- unnatural consistency
- generic phrasing
- shallow but polished analysis
- limited revision traces
- overly formulaic structure

Do not flag strong writing alone. Moderate or high risk requires multiple concerns.`
      : `You are an academic integrity analyst.

Compare submissions for suspicious similarity and independently assess AI-writing suspicion.

Rules:
- Similarity concerns must be based on substantive overlap in student-authored content.
- Ignore prompt text, boilerplate templates, file metadata, PDF artefacts, and reference sections.
- Treat properly quoted or cited material as cited overlap, not high-risk plagiarism.
- Distinguish cited overlap from uncited overlap.
- AI-writing concerns must rely on multiple indicators rather than one stylistic feature.
- Never output a verdict, only a risk indicator with evidence.`;

    const userContent: Array<Record<string, string>> = [];

    if (isSingleMode) {
      const sub = submissions[0];
      const content = contentMap.get(sub.id) || {
        plainText: "",
        fileType: "unsupported",
        mimeType: "application/octet-stream",
        success: false,
        extractionWarning: null,
        extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
        extractionQuality: null,
      };
      const processed = processedContentMap.get(sub.id) || preprocessSubmissionText(content.plainText);
      const preview = truncateText(processed.mainBody, MAX_SINGLE_TEXT_CHARS);

      userContent.push({
        type: "input_text",
        text: `Analyse this submission for AI-writing suspicion only.

Assignment: ${assignment.title}
Student: ${sub.student_name || sub.student_email || "Anonymous"}
File: ${sub.file_name || "submission"}

Main body (reference section removed for scoring):
${preview || "No readable text could be extracted."}

Citation signals detected: ${processed.citationPatternCount}
Reference section detected: ${processed.hasReferenceSection ? "yes" : "no"}
Quoted content share: ${Math.round(processed.quoteShare * 100)}%
Extraction quality: ${processed.extractionQuality ? `${processed.extractionQuality.qualityScore}/100` : "unknown"}

Return a structured flag only if there is a genuine concern. Otherwise return no flags.`,
      });
    } else {
      const summaries = submissions.map((submission) => {
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
        const preview = truncateText(processed.mainBody, MAX_MULTI_TEXT_CHARS);
        const studentLabel = `${submission.student_name || submission.student_email || "Anonymous"} (submission id: ${submission.id})`;
        if (!preview) {
          warnings.push(`No readable text extracted for ${submission.file_name || submission.id}; similarity analysis may be less reliable.`);
          return `${studentLabel}\n[no readable text extracted]`;
        }

        return `${studentLabel}
Reference section excluded: ${processed.hasReferenceSection ? "yes" : "no"}
Quoted content share: ${Math.round(processed.quoteShare * 100)}%
Citation markers detected: ${processed.citationPatternCount}
Extraction quality: ${processed.extractionQuality ? `${processed.extractionQuality.qualityScore}/100` : "unknown"}
Main body for scoring:
${preview}`;
      });

      userContent.push({
        type: "input_text",
        text: `Analyse these submissions for suspicious similarity and AI-writing indicators.

Assignment: ${assignment.title}

Submissions:
${summaries.join("\n\n---\n\n")}

Only flag real concerns. Return valid JSON only.`,
      });
    }

    let parsedFlags: IntegrityFlag[] = [];
    let summary = "Analysis complete";
    const shouldRunLegacy = providerMode === "llm_legacy" || providerMode === "both";
    const shouldRunInternalProvider = providerMode === "internal_text_similarity" || providerMode === "both";

    if (shouldRunLegacy) {
      try {
        const aiData = await createIntegrityResponseWithRetry({
          model: integrityModel,
          input: [
            { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: userContent },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "report_integrity_results",
              schema: {
                type: "object",
                properties: {
                  flags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        student_a: { type: "string" },
                        student_b: { type: "string" },
                        submission_a_id: { type: "string" },
                        submission_b_id: { type: "string" },
                        similarity_score: { type: "number" },
                        ai_suspicion_score: { type: "number" },
                        baseline_deviation_score: { type: "number" },
                        total_risk_score: { type: "number" },
                        reason: { type: "string" },
                        evidence_summary: { type: "string" },
                        matched_excerpt: { type: "string" },
                        recommended_action: { type: "string", enum: ["clear", "review", "investigate"] },
                        integrity_type: {
                          type: "string",
                          enum: ["similarity", "ai-writing", "baseline-deviation", "mixed"],
                        },
                        severity: { type: "string", enum: ["low", "medium", "high"] },
                        overlap_analysis: {
                          type: "object",
                          properties: {
                            total_overlap: { type: "number" },
                            cited_overlap: { type: "number" },
                            uncited_overlap: { type: "number" },
                            internal_peer_overlap: { type: "number" },
                            external_source_overlap: { type: "number" },
                          },
                          required: [
                            "total_overlap",
                            "cited_overlap",
                            "uncited_overlap",
                            "internal_peer_overlap",
                            "external_source_overlap",
                          ],
                          additionalProperties: false,
                        },
                        evidence_groups: {
                          type: "object",
                          properties: {
                            uncited_matches: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  value: { type: "string" },
                                  score: { type: "number" },
                                },
                                required: ["label", "value", "score"],
                                additionalProperties: false,
                              },
                            },
                            cited_matches: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  value: { type: "string" },
                                  score: { type: "number" },
                                },
                                required: ["label", "value", "score"],
                                additionalProperties: false,
                              },
                            },
                            peer_matches: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  value: { type: "string" },
                                  score: { type: "number" },
                                },
                                required: ["label", "value", "score"],
                                additionalProperties: false,
                              },
                            },
                            external_matches: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  value: { type: "string" },
                                  score: { type: "number" },
                                },
                                required: ["label", "value", "score"],
                                additionalProperties: false,
                              },
                            },
                          },
                          required: ["uncited_matches", "cited_matches", "peer_matches", "external_matches"],
                          additionalProperties: false,
                        },
                      },
                      required: [
                        "student_a",
                        "student_b",
                        "submission_a_id",
                        "submission_b_id",
                        "similarity_score",
                        "ai_suspicion_score",
                        "baseline_deviation_score",
                        "total_risk_score",
                        "reason",
                        "evidence_summary",
                        "matched_excerpt",
                        "recommended_action",
                        "integrity_type",
                        "severity",
                        "overlap_analysis",
                        "evidence_groups",
                      ],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string" },
                },
                required: ["flags", "summary"],
                additionalProperties: false,
              },
              strict: true,
            },
          },
        });

        try {
          const parsed = parseJsonText(extractOutputText(aiData));
          parsedFlags = normalizeFlags(parsed?.flags, submissions, processedContentMap);
          summary = typeof parsed?.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : summary;
        } catch {
          parsedFlags = normalizeFlags(aiData?.output?.[0]?.content?.[0]?.json?.flags, submissions, processedContentMap);
        }
      } catch (aiError) {
        warnings.push("AI similarity analysis was temporarily unavailable; returning baseline and persistence-safe results only.");
        logError("check-plagiarism AI analysis failed after retries", aiError);
      }
    }

    const internalFindings: IntegrityProviderFinding[] = [];
    if (shouldRunInternalProvider && submissions.length > 1) {
      const comparableSubmissions = submissions
        .map((submission) => {
          const content = contentMap.get(submission.id);
          if (!content) return null;
          return supportsInternalTextSimilarity(content)
            ? {
              submission,
              content,
            }
            : null;
        })
        .filter(
          (
            item,
          ): item is {
            submission: SubmissionRow;
            content: Awaited<ReturnType<typeof fetchFileContent>>;
          } => Boolean(item),
        );

      for (let leftIndex = 0; leftIndex < comparableSubmissions.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < comparableSubmissions.length; rightIndex += 1) {
          const left = comparableSubmissions[leftIndex];
          const right = comparableSubmissions[rightIndex];
          const pairwiseFinding = analyzeTextSimilarity(
            left.content.plainText,
            right.content.plainText,
            left.submission.id,
            right.submission.id,
            requestedAssignmentId,
          );
          internalFindings.push(pairwiseFinding);
        }
      }
    }

    const similarityBySubmission = new Map<string, number>();
    const aiBySubmission = new Map<string, number>();
    for (const flag of parsedFlags) {
      similarityBySubmission.set(
        flag.submission_a_id,
        Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_a_id) || 0),
      );
      aiBySubmission.set(
        flag.submission_a_id,
        Math.max(flag.ai_suspicion_score, aiBySubmission.get(flag.submission_a_id) || 0),
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

    for (const submission of submissions) {
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

    for (const flag of parsedFlags) {
      const submission = submissions.find((item) => item.id === flag.submission_a_id);
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

    const allFlags = [...parsedFlags, ...syntheticFlags].filter((flag, index, array) => {
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
      .in("submission_id", submissions.map((submission) => submission.id))
      .eq("lecturer_id", user.id);

    if (reviewsError && !isRecoverablePersistenceError(reviewsError)) throw reviewsError;
    if (reviewsError) {
      logWarn("academic_integrity_reviews unavailable, continuing without persisted reviews", {
        function: "check-plagiarism",
      });
    }

    const existingReviewMap = new Map(
      ((existingReviews || []) as Array<Record<string, unknown>>).map((review) => [String(review.submission_id), review]),
    );

    if (internalFindings.length > 0) {
      const submissionIds = submissions.map((submission) => submission.id);
      const { error: deleteFindingsError } = await supabaseAdmin
        .from("integrity_findings")
        .delete()
        .eq("assignment_id", requestedAssignmentId)
        .eq("provider", "internal_text_similarity")
        .in("submission_id", submissionIds);

      if (deleteFindingsError && !isRecoverablePersistenceError(deleteFindingsError)) {
        throw deleteFindingsError;
      }
      if (deleteFindingsError) {
        logWarn("Failed to clear prior internal integrity findings, continuing with insert attempt", {
          function: "check-plagiarism",
          assignmentId: requestedAssignmentId,
        });
      }

      const findingInserts = internalFindings.map(buildIntegrityFindingInsert);
      const { error: findingsInsertError } = await supabaseAdmin
        .from("integrity_findings")
        .insert(findingInserts);

      if (findingsInsertError && !isRecoverablePersistenceError(findingsInsertError)) {
        throw findingsInsertError;
      }
      if (findingsInsertError) {
        logWarn("Failed to persist internal integrity findings, continuing without evidence-table persistence", {
          function: "check-plagiarism",
          assignmentId: requestedAssignmentId,
          findingCount: findingInserts.length,
        });
      }
    }

    const reviewUpserts = submissions
      .map((submission) => {
        const snapshot = snapshots.get(submission.id) || null;
        const existingReview = existingReviewMap.get(submission.id);
        if (!snapshot && !existingReview) return null;

        const notePayload = (() => {
          if (existingReview?.lecturer_note && typeof existingReview.lecturer_note === "string") {
            try {
              const parsed = JSON.parse(existingReview.lecturer_note);
              return {
                latestNote: typeof parsed.latestNote === "string" ? parsed.latestNote : "",
                history: Array.isArray(parsed.history) ? parsed.history : [],
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
      if (persistError && !isRecoverablePersistenceError(persistError)) throw persistError;
      if (persistError) {
        logWarn("Failed to persist academic integrity reviews, returning analysis without persistence", {
          function: "check-plagiarism",
        });
      }
    }

    if (profileUpserts.length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("student_writing_profiles")
        .upsert(profileUpserts, { onConflict: "student_id" });
      if (profileError && !isRecoverablePersistenceError(profileError)) {
        throw profileError;
      }
      if (profileError) {
        logError("Failed to update writing profiles", profileError, {
          function: "check-plagiarism",
        });
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
      submissionCount: submissions.length,
      flags: thresholdCrossingFlags.length,
      warnings: warnings.length,
      durationMs: Date.now() - startedAt,
    });

    return new Response(JSON.stringify({ flags: allFlags, summary: finalSummary, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    logError("check-plagiarism error", e);
    return jsonError(e, corsHeaders);
  }
});
