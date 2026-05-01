import {
  createAnalysisLimitedFinding,
  mapSimilarityScoreToSeverity,
  type IntegrityProviderFinding,
} from "../integrity-provider.ts";

const DEFAULT_SHINGLE_SIZE = 8;
const MIN_WORD_COUNT = 50;
const MAX_MATCHED_PHRASES = 5;

function tokenizeText(text: string) {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function truncatePhrase(phrase: string, maxLength = 140) {
  if (phrase.length <= maxLength) return phrase;
  return `${phrase.slice(0, maxLength - 3)}...`;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createWordShingles(text: string, k = DEFAULT_SHINGLE_SIZE): Set<string> {
  const tokens = tokenizeText(text);
  if (tokens.length === 0) return new Set<string>();
  if (tokens.length < k) return new Set<string>([tokens.join(" ")]);

  const shingles = new Set<string>();
  for (let index = 0; index <= tokens.length - k; index += 1) {
    shingles.add(tokens.slice(index, index + k).join(" "));
  }

  return shingles;
}

export function calculateJaccardSimilarity(shinglesA: Set<string>, shinglesB: Set<string>): number {
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;

  let intersectionCount = 0;
  for (const shingle of shinglesA) {
    if (shinglesB.has(shingle)) intersectionCount += 1;
  }

  const unionCount = shinglesA.size + shinglesB.size - intersectionCount;
  if (unionCount === 0) return 0;

  return intersectionCount / unionCount;
}

export function analyzeTextSimilarity(
  submissionText: string,
  comparedText: string,
  submissionId: string,
  comparedId: string,
  assignmentId = "",
): IntegrityProviderFinding {
  const sourceWords = tokenizeText(submissionText);
  const comparedWords = tokenizeText(comparedText);

  if (sourceWords.length < MIN_WORD_COUNT || comparedWords.length < MIN_WORD_COUNT) {
    return createAnalysisLimitedFinding({
      provider: "internal_text_similarity",
      assignmentId,
      submissionId,
      comparedSubmissionId: comparedId,
      evidenceSummary:
        "Internal text similarity analysis was limited because one or both submissions were too short for a reliable comparison.",
      rawMetadata: {
        reason: "text_too_short",
        minimum_word_count: MIN_WORD_COUNT,
        submission_word_count: sourceWords.length,
        compared_word_count: comparedWords.length,
      },
    });
  }

  const sourceShingles = createWordShingles(submissionText);
  const comparedShingles = createWordShingles(comparedText);
  const similarityRatio = calculateJaccardSimilarity(sourceShingles, comparedShingles);
  const similarityScore = Math.round(similarityRatio * 100);

  const allMatches = [...sourceShingles].filter((shingle) => comparedShingles.has(shingle));
  const matchedPhrases = allMatches
    .slice(0, MAX_MATCHED_PHRASES)
    .map((phrase) => truncatePhrase(phrase));

  const evidenceSummary =
    similarityScore === 0
      ? "Internal text similarity found no meaningful shared phrasing between these submissions."
      : `Internal cohort similarity analysis found approximately ${similarityScore}% overlap in repeated word-pattern shingles. This is evidence for lecturer review, not a determination of misconduct.`;

  return {
    provider: "internal_text_similarity",
    assignment_id: assignmentId,
    submission_id: submissionId,
    compared_submission_id: comparedId,
    similarity_score: similarityScore,
    severity: mapSimilarityScoreToSeverity(similarityScore),
    evidence_summary: evidenceSummary,
    matched_phrases: matchedPhrases,
    raw_metadata: {
      method: "jaccard_word_shingles",
      shingle_size: DEFAULT_SHINGLE_SIZE,
      submission_word_count: sourceWords.length,
      compared_word_count: comparedWords.length,
      submission_shingle_count: sourceShingles.size,
      compared_shingle_count: comparedShingles.size,
      matched_shingle_count: allMatches.length,
      displayed_matched_phrase_count: matchedPhrases.length,
      compared_within_assignment_only: true,
    },
    analysis_limited: false,
  };
}
