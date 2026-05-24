import type { IntegrityProviderFinding } from "./integrity-provider.ts";

export type InternalSimilaritySubmission = {
  id: string;
  student_name: string | null;
  student_email: string | null;
};

export type InternalSimilarityFlagCandidate = {
  provider: IntegrityProviderFinding["provider"];
  submission_a_id: string;
  submission_b_id: string;
  student_a: string;
  student_b: string;
  similarity_score: number;
  ai_suspicion_score: number;
  baseline_deviation_score: number;
  total_risk_score: number;
  reason: string;
  evidence_summary: string;
  matched_excerpt: string;
  recommended_action: "clear" | "review" | "investigate";
  integrity_type: "similarity";
  severity: "low" | "medium" | "high";
};

export function buildInternalSimilarityFlagCandidates({
  findings,
  requestedSubmissionIds,
  submissions,
}: {
  findings: IntegrityProviderFinding[];
  requestedSubmissionIds: Set<string>;
  submissions: InternalSimilaritySubmission[];
}) {
  const submissionMap = new Map(submissions.map((submission) => [submission.id, submission]));

  return findings.flatMap((finding) => {
    const leftId = finding.submission_id;
    const rightId = finding.compared_submission_id ?? finding.submission_id;

    if (!requestedSubmissionIds.has(leftId) && !requestedSubmissionIds.has(rightId)) {
      return [];
    }

    const primaryId = requestedSubmissionIds.has(leftId) ? leftId : rightId;
    const secondaryId = primaryId === leftId ? rightId : leftId;
    const primarySubmission = submissionMap.get(primaryId);
    const secondarySubmission = submissionMap.get(secondaryId);
    const matchedExcerpt = finding.matched_phrases.find((phrase) => phrase.trim().length > 0) ?? "";
    const evidenceSummary = finding.evidence_summary || "Internal cohort similarity detected.";

    return [{
      provider: finding.provider,
      submission_a_id: primaryId,
      submission_b_id: secondaryId,
      student_a: primarySubmission?.student_name || primarySubmission?.student_email || "Student A",
      student_b: secondarySubmission?.student_name || secondarySubmission?.student_email || "Student B",
      similarity_score: finding.similarity_score,
      ai_suspicion_score: 0,
      baseline_deviation_score: 0,
      total_risk_score: finding.similarity_score,
      reason: evidenceSummary,
      evidence_summary: evidenceSummary,
      matched_excerpt: matchedExcerpt,
      recommended_action: finding.similarity_score >= 80 ? "investigate" : "review",
      integrity_type: "similarity" as const,
      severity: finding.severity,
    } satisfies InternalSimilarityFlagCandidate];
  });
}
