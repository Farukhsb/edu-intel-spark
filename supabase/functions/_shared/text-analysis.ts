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

export interface ExtractionQualityResult {
  isUsable: boolean;
  wordCount: number;
  artifactRatio: number;
  qualityScore: number;
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

const PDF_ARTIFACT_PATTERN =
  /\b(?:obj|endobj|xref|endxref|stream|endstream|trailer|startxref|\/Type|\/Length|\/Filter|\/Root|\/Info|\/Page|\/Pages|\/Catalog)\b/g;

function decodePdfLiteralString(value: string) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      decoded += char;
      continue;
    }

    const next = value[index + 1];
    if (!next) break;

    if (/[0-7]/.test(next)) {
      const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] || next;
      decoded += String.fromCharCode(parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    const escapeMap: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "(": "(",
      ")": ")",
      "\\": "\\",
    };

    decoded += escapeMap[next] ?? next;
    index += 1;
  }

  return decoded;
}

function extractPdfTextFromOperators(binary: string) {
  const segments: string[] = [];
  const textBlocks = binary.match(/BT[\s\S]*?ET/g) || [];

  for (const block of textBlocks) {
    const literalMatches = block.match(/\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")/g) || [];
    for (const match of literalMatches) {
      const literal = match.match(/\(([\s\S]*)\)\s*(?:Tj|'|")$/)?.[1];
      if (literal) segments.push(decodePdfLiteralString(literal));
    }

    const arrayMatches = block.match(/\[(?:[\s\S]*?)\]\s*TJ/g) || [];
    for (const match of arrayMatches) {
      const stringParts = match.match(/\((?:\\.|[^\\)])*\)/g) || [];
      for (const part of stringParts) {
        segments.push(decodePdfLiteralString(part.slice(1, -1)));
      }
    }
  }

  return segments.join(" ");
}

export function cleanExtractedDocumentText(input: string) {
  return normalizeReadableText(
    input
      .replace(PDF_ARTIFACT_PATTERN, " ")
      .replace(/\/[A-Za-z0-9#_.-]+/g, " ")
      .replace(/\b\d+\s+\d+\s+R\b/g, " ")
      .replace(/[<>[\]{}]/g, " ")
      .replace(/[_]{2,}/g, " ")
      .replace(/([a-z])-\n([a-z])/gi, "$1$2")
      .replace(/\s*\n\s*/g, "\n"),
  );
}

export function extractReadablePdfTextFromBase64(base64: string) {
  const binary = atob(base64);
  const operatorText = extractPdfTextFromOperators(binary);
  const printableFallback = (binary.match(/[\x20-\x7E]{4,}/g) || []).join(" ");
  const combined = [operatorText, printableFallback].filter(Boolean).join("\n");
  return cleanExtractedDocumentText(combined);
}

export function assessExtractionQuality(text: string): ExtractionQualityResult {
  const normalized = cleanExtractedDocumentText(text);
  const words = normalized.match(/\b[\p{L}\p{N}']+\b/gu) || [];
  const artifactMatches = normalized.match(PDF_ARTIFACT_PATTERN) || [];
  const artifactRatio = words.length > 0 ? artifactMatches.length / words.length : 1;
  const averageWordLength =
    words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;

  const reasons: string[] = [];
  let qualityScore = 100;

  if (words.length < 120) {
    qualityScore -= 35;
    reasons.push("Very little readable body text was extracted.");
  }

  if (artifactRatio > 0.08) {
    qualityScore -= 35;
    reasons.push("Extracted text still contains a high proportion of PDF artefacts.");
  }

  if (averageWordLength < 3.5) {
    qualityScore -= 15;
    reasons.push("Extracted text appears fragmented or tokenised poorly.");
  }

  if (!/[.?!]/.test(normalized)) {
    qualityScore -= 10;
    reasons.push("Extracted text contains few recognisable sentence boundaries.");
  }

  return {
    isUsable: qualityScore >= 45 && words.length >= 80,
    wordCount: words.length,
    artifactRatio: round(artifactRatio, 3),
    qualityScore: Math.max(0, qualityScore),
    reasons,
  };
}

export function classifyAssignmentType(params: {
  title?: string | null;
  description?: string | null;
  rubricText?: string | null;
  fileName?: string | null;
  text?: string | null;
}): AssignmentType {
  const haystack = `${params.title || ""}\n${params.description || ""}\n${params.rubricText || ""}\n${params.text || ""}`.toLowerCase();
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
