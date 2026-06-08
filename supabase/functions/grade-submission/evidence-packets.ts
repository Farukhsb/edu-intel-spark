import type { RubricCriterion } from "./prompting.ts";

const EVIDENCE_PACKET_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have", "how", "if", "in",
  "into", "is", "it", "its", "of", "on", "or", "that", "the", "their", "there", "these", "this", "to", "was",
  "were", "what", "which", "with", "within", "your",
]);

function normalizeEvidenceKeyword(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractEvidenceKeywords(input: string) {
  return normalizeEvidenceKeyword(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !EVIDENCE_PACKET_STOPWORDS.has(token));
}

function splitEvidenceSegments(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 120);

  if (paragraphs.length >= 3) {
    return paragraphs;
  }

  const segments: string[] = [];
  const chunkSize = 1400;
  const overlap = 300;
  let index = 0;
  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize).trim();
    if (chunk.length >= 120) {
      segments.push(chunk);
    }
    if (index + chunkSize >= text.length) break;
    index += chunkSize - overlap;
  }

  return segments;
}

function scoreEvidenceSegment(segment: string, keywords: string[], index: number, total: number) {
  const normalizedSegment = normalizeEvidenceKeyword(segment);
  const matchedKeywords = keywords.filter((keyword) => normalizedSegment.includes(keyword));
  const uniqueMatches = new Set(matchedKeywords);
  const lengthScore = Math.min(3, Math.round(segment.length / 500));
  const edgeBonus = index === 0 || index === total - 1 ? 1 : 0;

  return {
    score: uniqueMatches.size * 2 + lengthScore + edgeBonus,
    matchedKeywords: Array.from(uniqueMatches).slice(0, 8),
  };
}

function truncateEvidenceSection(text: string, maxChars: number) {
  if (text.length <= maxChars) return text.trim();
  return `${text.slice(0, maxChars).trim()}\n[truncated]`;
}

export type CriterionEvidencePacket = {
  criterion: string;
  packet: string;
  matchedKeywords: string[];
};

export function buildGradingEvidencePacket(params: {
  submissionText: string;
  rubric: RubricCriterion[];
  assignmentTitle: string;
  assignmentDescription?: string | null;
  maxChars?: number;
}) {
  const maxChars = params.maxChars ?? 18_000;
  const normalizedText = params.submissionText.trim();
  if (!normalizedText) return "";

  const keywords = Array.from(
    new Set([
      ...extractEvidenceKeywords(params.assignmentTitle),
      ...extractEvidenceKeywords(params.assignmentDescription || ""),
      ...params.rubric.flatMap((criterion) => extractEvidenceKeywords(`${criterion.criterion} ${criterion.description || ""}`)),
    ]),
  ).slice(0, 28);

  const introSection = truncateEvidenceSection(normalizedText.slice(0, 2800), 2800);
  const closingStart = Math.max(0, normalizedText.length - 2200);
  const closingSection = truncateEvidenceSection(normalizedText.slice(closingStart), 2200);
  const segmentCandidates = splitEvidenceSegments(normalizedText)
    .map((segment, index, array) => ({ segment, index, ...scoreEvidenceSegment(segment, keywords, index, array.length) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const packetSections: string[] = [];
  const seenSegments = new Set<string>();
  let remainingChars = maxChars;

  const pushSection = (label: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const dedupeKey = normalizeEvidenceKeyword(trimmed).slice(0, 240);
    if (!dedupeKey || seenSegments.has(dedupeKey)) return;

    const sectionText = `${label}\n${trimmed}`;
    if (sectionText.length > remainingChars) {
      if (remainingChars < 240) return;
      const allowedContent = Math.max(120, remainingChars - label.length - 2);
      const truncated = `${label}\n${truncateEvidenceSection(trimmed, allowedContent)}`;
      if (truncated.length > remainingChars) return;
      packetSections.push(truncated);
      remainingChars -= truncated.length + 2;
      seenSegments.add(dedupeKey);
      return;
    }

    packetSections.push(sectionText);
    remainingChars -= sectionText.length + 2;
    seenSegments.add(dedupeKey);
  };

  pushSection("OPENING SECTION:", introSection);

  segmentCandidates.forEach((candidate, index) => {
    const keywordNote =
      candidate.matchedKeywords.length > 0 ? `Matched rubric cues: ${candidate.matchedKeywords.join(", ")}` : "Relevant mid-submission evidence";
    pushSection(`RUBRIC-ALIGNED EXCERPT ${index + 1} (${keywordNote}):`, candidate.segment);
  });

  if (closingSection && normalizeEvidenceKeyword(closingSection) !== normalizeEvidenceKeyword(introSection)) {
    pushSection("CLOSING SECTION:", closingSection);
  }

  return packetSections.join("\n\n").trim();
}

export function buildCriterionEvidencePackets(params: {
  submissionText: string;
  rubric: RubricCriterion[];
  assignmentTitle: string;
  assignmentDescription?: string | null;
  maxCharsPerCriterion?: number;
}) {
  const normalizedText = params.submissionText.trim();
  if (!normalizedText) {
    return params.rubric.map((criterion) => ({
      criterion: criterion.criterion,
      packet: "",
      matchedKeywords: [],
    }));
  }

  const assignmentKeywords = [
    ...extractEvidenceKeywords(params.assignmentTitle),
    ...extractEvidenceKeywords(params.assignmentDescription || ""),
  ];
  const segments = splitEvidenceSegments(normalizedText);
  const introSection = truncateEvidenceSection(normalizedText.slice(0, 1800), 1800);
  const closingStart = Math.max(0, normalizedText.length - 1400);
  const closingSection = truncateEvidenceSection(normalizedText.slice(closingStart), 1400);
  const maxCharsPerCriterion = params.maxCharsPerCriterion ?? 2600;

  return params.rubric.map((criterion) => {
    const criterionKeywords = Array.from(
      new Set([
        ...assignmentKeywords,
        ...extractEvidenceKeywords(criterion.criterion),
        ...extractEvidenceKeywords(criterion.description || ""),
      ]),
    ).slice(0, 18);

    const rankedSegments = segments
      .map((segment, index, array) => ({
        segment,
        index,
        ...scoreEvidenceSegment(segment, criterionKeywords, index, array.length),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    const pieces: string[] = [];
    let remainingChars = maxCharsPerCriterion;
    const pushPiece = (label: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed || remainingChars < 140) return;
      const section = `${label}\n${truncateEvidenceSection(trimmed, Math.max(120, remainingChars - label.length - 2))}`;
      if (section.length > remainingChars) return;
      pieces.push(section);
      remainingChars -= section.length + 2;
    };

    pushPiece("Criterion context:", `${criterion.criterion}${criterion.description ? ` -> ${criterion.description}` : ""}`);
    pushPiece("Opening evidence:", introSection);
    rankedSegments.forEach((candidate, index) => {
      const keywordNote =
        candidate.matchedKeywords.length > 0 ? candidate.matchedKeywords.join(", ") : "general relevance";
      pushPiece(`Focused excerpt ${index + 1} (matched: ${keywordNote}):`, candidate.segment);
    });
    if (closingSection && normalizeEvidenceKeyword(closingSection) !== normalizeEvidenceKeyword(introSection)) {
      pushPiece("Closing evidence:", closingSection);
    }

    const matchedKeywords = Array.from(
      new Set(rankedSegments.flatMap((candidate) => candidate.matchedKeywords)),
    ).slice(0, 8);

    return {
      criterion: criterion.criterion,
      packet: pieces.join("\n\n").trim(),
      matchedKeywords,
    } satisfies CriterionEvidencePacket;
  });
}
