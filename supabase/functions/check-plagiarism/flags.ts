import type { IntegrityFlag } from "./analysis.ts";
import type { ProcessedSubmissionText, SubmissionRow } from "./analysis.ts";
import { actionFromRisk, computeRisk, deriveCitationAwareOverlap, normalizeScoresByContext, severityFromRisk, normalizeArtifactDrivenReason, buildFallbackEvidenceItem } from "./analysis.ts";
import { ExistingReviewNoteSchema } from "./request.ts";

export function normalizeFlags(
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
      const severity = candidate.severity === "high" || candidate.severity === "medium" || candidate.severity === "low" ? candidate.severity : "medium";
      const recommendedAction = candidate.recommended_action === "clear" || candidate.recommended_action === "review" || candidate.recommended_action === "investigate"
        ? candidate.recommended_action
        : "review";
      const integrityType = candidate.integrity_type === "similarity" || candidate.integrity_type === "ai-writing" || candidate.integrity_type === "baseline-deviation" || candidate.integrity_type === "mixed"
        ? candidate.integrity_type
        : "mixed";
      const provider = candidate.provider === "moss" ? "moss" : "other";
      const normalizedScores = normalizeScoresByContext(
        Number(candidate.similarity_score) || 0,
        Number(candidate.ai_suspicion_score) || 0,
        severity,
        integrityType,
        recommendedAction,
      );
      const overlap = provider === "moss"
        ? {
          classification: "uncited" as const,
          effectiveSimilarity: normalizedScores.similarity,
          overlap: {
            total_overlap: normalizedScores.similarity,
            cited_overlap: 0,
            uncited_overlap: normalizedScores.similarity,
            internal_peer_overlap: submissionAId !== submissionBId ? normalizedScores.similarity : 0,
            external_source_overlap: 0,
            reference_section_overlap: 0,
            heavy_source_reliance: false,
          },
        }
        : deriveCitationAwareOverlap({
          baseSimilarity: normalizedScores.similarity,
          excerpt: typeof candidate.matched_excerpt === "string" ? candidate.matched_excerpt.trim() : "",
          submissionA: processedContent.get(submissionAId),
          submissionB: processedContent.get(submissionBId),
          provided: candidate.overlap_analysis && typeof candidate.overlap_analysis === "object"
            ? (candidate.overlap_analysis as Record<string, unknown>)
            : undefined,
          isPeerMatch: submissionAId !== submissionBId,
        });
      const baselineDeviationScore = Number(candidate.baseline_deviation_score) || 0;
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
        ? ((candidate.evidence_groups as Record<string, unknown>).uncited_matches as Array<{ label: string; value: string; score: number }>)
        : overlap.classification === "uncited"
          ? [buildFallbackEvidenceItem("Uncited match", baseEvidenceText, overlap.overlap.uncited_overlap)]
          : [];
      const citedMatches = Array.isArray((candidate.evidence_groups as Record<string, unknown> | undefined)?.cited_matches)
        ? ((candidate.evidence_groups as Record<string, unknown>).cited_matches as Array<{ label: string; value: string; score: number }>)
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
        ? ((candidate.evidence_groups as Record<string, unknown>).peer_matches as Array<{ label: string; value: string; score: number }>)
        : submissionAId !== submissionBId
          ? [buildFallbackEvidenceItem("Peer overlap", baseEvidenceText, overlap.overlap.internal_peer_overlap)]
          : [];
      const externalMatches = Array.isArray((candidate.evidence_groups as Record<string, unknown> | undefined)?.external_matches)
        ? ((candidate.evidence_groups as Record<string, unknown>).external_matches as Array<{ label: string; value: string; score: number }>)
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
        flag.similarity_score >= 25 ||
        flag.ai_suspicion_score >= 25 ||
        flag.baseline_deviation_score >= 25 ||
        flag.total_risk_score >= 25,
    );
}

export function mergeIntegrityFlags(flags: IntegrityFlag[]) {
  const merged = new Map<string, IntegrityFlag>();

  for (const flag of flags) {
    const pairKey = [
      flag.submission_a_id,
      flag.submission_b_id,
      flag.integrity_type === "similarity" ? "similarity" : flag.integrity_type,
    ].join(":");
    const existing = merged.get(pairKey);

    if (!existing) {
      merged.set(pairKey, flag);
      continue;
    }

    const overlap = {
      total_overlap: Math.max(existing.overlap_analysis?.total_overlap || 0, flag.overlap_analysis?.total_overlap || 0),
      cited_overlap: Math.max(existing.overlap_analysis?.cited_overlap || 0, flag.overlap_analysis?.cited_overlap || 0),
      uncited_overlap: Math.max(existing.overlap_analysis?.uncited_overlap || 0, flag.overlap_analysis?.uncited_overlap || 0),
      internal_peer_overlap: Math.max(existing.overlap_analysis?.internal_peer_overlap || 0, flag.overlap_analysis?.internal_peer_overlap || 0),
      external_source_overlap: Math.max(existing.overlap_analysis?.external_source_overlap || 0, flag.overlap_analysis?.external_source_overlap || 0),
      reference_section_overlap: Math.max(existing.overlap_analysis?.reference_section_overlap || 0, flag.overlap_analysis?.reference_section_overlap || 0),
      heavy_source_reliance:
        Boolean(existing.overlap_analysis?.heavy_source_reliance) ||
        Boolean(flag.overlap_analysis?.heavy_source_reliance),
    };

    const reason = [existing.reason, flag.reason].filter(Boolean).join(" | ");
    const evidenceSummary = [existing.evidence_summary, flag.evidence_summary]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join(" ");

    merged.set(pairKey, {
      ...existing,
      similarity_score: Math.max(existing.similarity_score, flag.similarity_score),
      ai_suspicion_score: Math.max(existing.ai_suspicion_score, flag.ai_suspicion_score),
      baseline_deviation_score: Math.max(existing.baseline_deviation_score, flag.baseline_deviation_score),
      total_risk_score: Math.max(existing.total_risk_score, flag.total_risk_score),
      reason,
      evidence_summary: evidenceSummary || existing.evidence_summary || flag.evidence_summary,
      matched_excerpt: existing.matched_excerpt || flag.matched_excerpt,
      recommended_action:
        existing.recommended_action === "investigate" || flag.recommended_action === "investigate"
          ? "investigate"
          : existing.recommended_action === "review" || flag.recommended_action === "review"
            ? "review"
            : "clear",
      severity:
        existing.severity === "high" || flag.severity === "high"
          ? "high"
          : existing.severity === "medium" || flag.severity === "medium"
            ? "medium"
            : "low",
      overlap_analysis: overlap,
      evidence_groups: {
        uncited_matches: [...(existing.evidence_groups?.uncited_matches || []), ...(flag.evidence_groups?.uncited_matches || [])],
        cited_matches: [...(existing.evidence_groups?.cited_matches || []), ...(flag.evidence_groups?.cited_matches || [])],
        peer_matches: [...(existing.evidence_groups?.peer_matches || []), ...(flag.evidence_groups?.peer_matches || [])],
        external_matches: [...(existing.evidence_groups?.external_matches || []), ...(flag.evidence_groups?.external_matches || [])],
      },
    });
  }

  return [...merged.values()];
}
