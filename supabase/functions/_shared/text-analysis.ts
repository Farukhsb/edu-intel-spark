export type AssignmentType =
  | "Essay"
  | "Report"
  | "Code"
  | "Reflective"
  | "Problem Solving"
  | "Mathematics";

export interface WritingProfileMetrics {
  average_sentence_complexity: number;
  lexile_level: number;
  error_fingerprint: string[];
  vocabulary_breadth: number;
  word_count: number;
  sentence_count: number;
  average_words_per_sentence: number;
}

export interface StoredWritingProfile extends WritingProfileMetrics {
  sample_count: number;
}

export interface BaselineDeviationResult {
  score: number;
  reasons: string[];
}

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have", "if", "in",
  "into", "is", "it", "of", "on", "or", "that", "the", "their", "then", "there", "these", "they",
  "this", "to", "was", "were", "with",
]);

const SUBORDINATE_MARKERS = /\b(because|although|though|while|whereas|since|unless|however|which|who|that|if|when|after|before)\b/gi;

function round(value: number, precision = 2) {
  return Number(value.toFixed(precision));
}

export function normalizeReadableText(input: string) {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function classifyAssignmentType(params: {
  title?: string | null;
  description?: string | null;
  rubricText?: string | null;
  fileName?: string | null;
  text?: string | null;
}): AssignmentType {
  const haystack = `${params.title || ""}\n${params.description || ""}\n${params.rubricText || ""}\n${params.fileName || ""}\n${params.text || ""}`.toLowerCase();
  const extension = (params.fileName || "").toLowerCase().split(".").pop() || "";

  if (
    /mathematics|calculus|algebra|equation|differentiat|integrat|proof|solve|derivation|matrix|trigonometry|latex/.test(haystack)
  ) {
    return "Mathematics";
  }

  if (["py", "js", "ts", "tsx", "java", "cpp", "c", "cs", "rb", "go", "rs", "php", "html", "css"].includes(extension)) {
    return "Code";
  }

  if (/reflective|reflection|personal learning|self-assessment|what i learned|experience/.test(haystack)) {
    return "Reflective";
  }

  if (/report|findings|methodology|results|discussion|executive summary/.test(haystack)) {
    return "Report";
  }

  if (/problem solving|case study|scenario|short answer|worked solution|show your working/.test(haystack)) {
    return "Problem Solving";
  }

  if (/essay|argument|thesis|critical discussion|literature review/.test(haystack)) {
    return "Essay";
  }

  if (/[=+\-*/^]|\\frac|\\sum|\\int/.test(params.text || "")) {
    return "Mathematics";
  }

  return "Essay";
}

export function computeWritingProfileMetrics(text: string): WritingProfileMetrics {
  const normalized = normalizeReadableText(text);
  const words = (normalized.toLowerCase().match(/\b[\p{L}\p{N}']+\b/gu) || []).filter(Boolean);
  const sentences = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const subordinateMatches = normalized.match(SUBORDINATE_MARKERS) || [];
  const uniqueWords = new Set(words.filter((word) => !STOPWORDS.has(word)));
  const averageWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : words.length;
  const averageSentenceComplexity =
    sentences.length > 0 ? subordinateMatches.length / sentences.length : subordinateMatches.length;

  const syllableCount = words.reduce((sum, word) => {
    const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!cleaned) return sum;
    const groups = cleaned
      .replace(/e$/, "")
      .match(/[aeiouy]{1,2}/g);
    return sum + Math.max(1, groups?.length || 0);
  }, 0);

  const fleschKincaid =
    words.length > 0 && sentences.length > 0
      ? 0.39 * (words.length / sentences.length) + 11.8 * (syllableCount / words.length) - 15.59
      : 0;

  const lexileLevel = round(Math.max(0, 200 + fleschKincaid * 120), 0);

  const fingerprintCandidates: Array<[string, boolean]> = [
    ["comma_splice_risk", /,[ \t]+[a-z]/.test(normalized) && /,[ \t]+(however|therefore|moreover|thus)\b/i.test(normalized)],
    ["double_space", /  +/.test(text)],
    ["missing_cap_after_period", /\.[ \t]+[a-z]/.test(normalized)],
    ["exclamation_usage", /!/.test(normalized)],
    ["semicolon_usage", /;/.test(normalized)],
    ["bullet_heavy", /(^|\n)\s*[-*]\s+/m.test(normalized)],
    ["british_spelling", /\b(colour|analyse|organise|behaviour)\b/i.test(normalized)],
    ["american_spelling", /\b(color|analyze|organize|behavior)\b/i.test(normalized)],
  ];

  return {
    average_sentence_complexity: round(averageSentenceComplexity),
    lexile_level: lexileLevel,
    error_fingerprint: fingerprintCandidates.filter(([, present]) => present).map(([label]) => label),
    vocabulary_breadth: round(words.length > 0 ? uniqueWords.size / words.length : 0, 3),
    word_count: words.length,
    sentence_count: sentences.length,
    average_words_per_sentence: round(averageWordsPerSentence),
  };
}

export function computeBaselineDeviation(
  baseline: Partial<StoredWritingProfile> | null | undefined,
  current: WritingProfileMetrics,
  gradeContext?: { previousAverage?: number | null; currentGrade?: number | null },
): BaselineDeviationResult {
  if (!baseline || !baseline.sample_count) {
    return { score: 0, reasons: [] };
  }

  const reasons: string[] = [];
  let score = 0;

  const complexityGap = Math.abs((baseline.average_sentence_complexity || 0) - current.average_sentence_complexity);
  if (complexityGap >= 0.35) {
    score += 22;
    reasons.push("Sentence complexity shifted materially from the student's baseline.");
  }

  const lexileGap = Math.abs((baseline.lexile_level || 0) - current.lexile_level);
  if (lexileGap >= 180) {
    score += 22;
    reasons.push("Readability level shifted sharply from prior submissions.");
  }

  const vocabGap = Math.abs((baseline.vocabulary_breadth || 0) - current.vocabulary_breadth);
  if (vocabGap >= 0.08) {
    score += 18;
    reasons.push("Vocabulary breadth deviates from the stored writing profile.");
  }

  const previousFingerprint = new Set(Array.isArray(baseline.error_fingerprint) ? baseline.error_fingerprint : []);
  const currentFingerprint = new Set(current.error_fingerprint);
  const disappearedSignals = Array.from(previousFingerprint).filter((item) => !currentFingerprint.has(item));
  if (previousFingerprint.size > 0 && disappearedSignals.length === previousFingerprint.size) {
    score += 28;
    reasons.push("The student's usual error fingerprint disappeared completely.");
  }

  if (
    gradeContext?.previousAverage != null &&
    gradeContext?.currentGrade != null &&
    gradeContext.previousAverage <= 50 &&
    gradeContext.currentGrade >= 80 &&
    gradeContext.currentGrade - gradeContext.previousAverage >= 25
  ) {
    score += 18;
    reasons.push("Submission quality coincides with an unusually large grade jump from the student's prior average.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

export function mergeWritingProfile(
  baseline: Partial<StoredWritingProfile> | null | undefined,
  current: WritingProfileMetrics,
): StoredWritingProfile {
  const sampleCount = Math.max(0, baseline?.sample_count || 0);
  const nextCount = sampleCount + 1;
  const weighted = (previous: number | undefined, next: number) =>
    round(((previous || 0) * sampleCount + next) / nextCount, 3);

  const mergedFingerprint = Array.from(
    new Set([...(Array.isArray(baseline?.error_fingerprint) ? baseline!.error_fingerprint : []), ...current.error_fingerprint]),
  ).slice(0, 8);

  return {
    average_sentence_complexity: weighted(baseline?.average_sentence_complexity, current.average_sentence_complexity),
    lexile_level: weighted(baseline?.lexile_level, current.lexile_level),
    error_fingerprint: mergedFingerprint,
    vocabulary_breadth: weighted(baseline?.vocabulary_breadth, current.vocabulary_breadth),
    word_count: weighted(baseline?.word_count, current.word_count),
    sentence_count: weighted(baseline?.sentence_count, current.sentence_count),
    average_words_per_sentence: weighted(baseline?.average_words_per_sentence, current.average_words_per_sentence),
    sample_count: nextCount,
  };
}
