import {
  createAnalysisLimitedFinding,
  mapSimilarityScoreToSeverity,
  type IntegrityProviderFinding,
} from "../integrity-provider.ts";

const DEFAULT_SHINGLE_SIZE = 8;
const MIN_WORD_COUNT = 50;
const MAX_MATCHED_PHRASES = 5;
const MIN_CONCEPT_TOKEN_LENGTH = 3;
const LEXICAL_SIMILARITY_WEIGHT = 0.55;
const CONCEPT_SIMILARITY_WEIGHT = 0.45;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
  "he", "her", "his", "if", "in", "into", "is", "it", "its", "of", "on", "or", "she", "that", "the",
  "their", "them", "there", "these", "they", "this", "to", "was", "were", "which", "with", "would",
]);

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

function stemToken(token: string) {
  let stemmed = token;

  const replacements: Array<[RegExp, string]> = [
    [/ies$/u, "y"],
    [/ments$/u, "ment"],
    [/ations$/u, "ation"],
    [/izers$/u, "izer"],
    [/ises$/u, "ise"],
    [/izes$/u, "ize"],
    [/ingly$/u, ""],
    [/edly$/u, ""],
    [/ing$/u, ""],
    [/ed$/u, ""],
    [/es$/u, ""],
    [/s$/u, ""],
  ];

  for (const [pattern, replacement] of replacements) {
    if (stemmed.length <= 4) break;
    const next = stemmed.replace(pattern, replacement);
    if (next !== stemmed) {
      stemmed = next;
      break;
    }
  }

  return stemmed;
}

function createConceptTokenSet(text: string) {
  const concepts = new Set<string>();

  for (const token of tokenizeText(text)) {
    if (token.length < MIN_CONCEPT_TOKEN_LENGTH) continue;
    if (/^\d+$/u.test(token)) continue;
    if (STOPWORDS.has(token)) continue;

    const normalized = stemToken(token);
    if (normalized.length < MIN_CONCEPT_TOKEN_LENGTH) continue;
    if (STOPWORDS.has(normalized)) continue;
    concepts.add(normalized);
  }

  return concepts;
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

export function calculateDiceSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionCount += 1;
  }

  return (2 * intersectionCount) / (tokensA.size + tokensB.size);
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
  const lexicalSimilarityRatio = calculateJaccardSimilarity(sourceShingles, comparedShingles);
  const sourceConcepts = createConceptTokenSet(submissionText);
  const comparedConcepts = createConceptTokenSet(comparedText);
  const conceptSimilarityRatio = calculateDiceSimilarity(sourceConcepts, comparedConcepts);
  const blendedSimilarityRatio =
    lexicalSimilarityRatio * LEXICAL_SIMILARITY_WEIGHT +
    conceptSimilarityRatio * CONCEPT_SIMILARITY_WEIGHT;
  const similarityScore = Math.round(blendedSimilarityRatio * 100);

  const allMatches = [...sourceShingles].filter((shingle) => comparedShingles.has(shingle));
  const matchedPhrases = allMatches
    .slice(0, MAX_MATCHED_PHRASES)
    .map((phrase) => truncatePhrase(phrase));

  const evidenceSummary =
    similarityScore === 0
      ? "Internal text similarity found no meaningful shared phrasing or concept overlap between these submissions."
      : `Internal cohort similarity analysis found approximately ${similarityScore}% blended overlap from repeated word-pattern shingles and normalized concept overlap. This is evidence for lecturer review, not a determination of misconduct.`;

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
      method: "hybrid_shingles_and_concepts",
      shingle_size: DEFAULT_SHINGLE_SIZE,
      lexical_similarity_ratio: Number(lexicalSimilarityRatio.toFixed(3)),
      concept_similarity_ratio: Number(conceptSimilarityRatio.toFixed(3)),
      lexical_similarity_weight: LEXICAL_SIMILARITY_WEIGHT,
      concept_similarity_weight: CONCEPT_SIMILARITY_WEIGHT,
      submission_word_count: sourceWords.length,
      compared_word_count: comparedWords.length,
      submission_shingle_count: sourceShingles.size,
      compared_shingle_count: comparedShingles.size,
      matched_shingle_count: allMatches.length,
      submission_concept_count: sourceConcepts.size,
      compared_concept_count: comparedConcepts.size,
      displayed_matched_phrase_count: matchedPhrases.length,
      compared_within_assignment_only: true,
    },
    analysis_limited: false,
  };
}
