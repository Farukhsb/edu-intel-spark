export type IntegrityProviderName =
  | "internal_text_similarity"
  | "llm_legacy"
  | "moss"
  | "external_provider";

export type IntegritySeverity = "low" | "medium" | "high";

export type IntegrityProviderFinding = {
  provider: IntegrityProviderName;
  assignment_id: string;
  submission_id: string;
  compared_submission_id?: string | null;
  similarity_score: number;
  severity: IntegritySeverity;
  evidence_summary: string;
  matched_phrases: string[];
  raw_metadata: Record<string, unknown>;
  analysis_limited: boolean;
};

export type IntegrityProviderInput = {
  assignmentId: string;
  submissionId: string;
  submissionText: string;
  comparedSubmissionId?: string | null;
  comparedText?: string | null;
  providerMetadata?: Record<string, unknown>;
};

export function mapSimilarityScoreToSeverity(similarityScore: number): IntegritySeverity {
  if (similarityScore >= 80) return "high";
  if (similarityScore >= 50) return "medium";
  return "low";
}

export function createAnalysisLimitedFinding(params: {
  provider: IntegrityProviderName;
  assignmentId: string;
  submissionId: string;
  comparedSubmissionId?: string | null;
  evidenceSummary: string;
  similarityScore?: number;
  matchedPhrases?: string[];
  rawMetadata?: Record<string, unknown>;
}): IntegrityProviderFinding {
  const similarityScore = Number.isFinite(params.similarityScore) ? Number(params.similarityScore) : 0;

  return {
    provider: params.provider,
    assignment_id: params.assignmentId,
    submission_id: params.submissionId,
    compared_submission_id: params.comparedSubmissionId ?? null,
    similarity_score: similarityScore,
    severity: mapSimilarityScoreToSeverity(similarityScore),
    evidence_summary: params.evidenceSummary,
    matched_phrases: params.matchedPhrases ?? [],
    raw_metadata: params.rawMetadata ?? {},
    analysis_limited: true,
  };
}

export type IntegrityFindingInsert = {
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

export function buildIntegrityFindingInsert(finding: IntegrityProviderFinding): IntegrityFindingInsert {
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
