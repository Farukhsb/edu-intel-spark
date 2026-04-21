import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { serializeReviewPayload, type IntegrityDecision, type IntegrityHistoryEntry } from "@/lib/integrityReviews";
import type { FlaggedIntegrityCase } from "@/lib/integrityQueue";

export interface PersistIntegrityDecisionInput {
  supabase: SupabaseClient<Database>;
  lecturerId: string;
  item: FlaggedIntegrityCase;
  decision: IntegrityDecision;
  note: string;
  reviewType: string;
  now?: () => Date;
}

export interface PersistIntegrityDecisionResult {
  error: unknown;
  nextHistory: IntegrityHistoryEntry[];
}

const buildEvidenceSummary = (item: FlaggedIntegrityCase) =>
  [
    ...item.evidence.aiWriting.map((entry) => `${entry.label}: ${entry.value}`),
    ...item.evidence.similarity.map((entry) => `${entry.label}: ${entry.value}`),
    ...item.evidence.uncitedMatches.map((entry) => `${entry.label}: ${entry.value}`),
    ...item.evidence.citedMatches.map((entry) => `${entry.label}: ${entry.value}`),
    ...item.evidence.peerMatches.map((entry) => `${entry.label}: ${entry.value}`),
    ...item.evidence.externalMatches.map((entry) => `${entry.label}: ${entry.value}`),
    ...item.evidence.baselineDeviation.map((entry) => `${entry.label}: ${entry.value}`),
  ]
    .slice(0, 8)
    .join("\n\n");

export const persistIntegrityDecision = async ({
  supabase,
  lecturerId,
  item,
  decision,
  note,
  reviewType,
  now = () => new Date(),
}: PersistIntegrityDecisionInput): Promise<PersistIntegrityDecisionResult> => {
  const trimmedNote = note.trim();
  const nextEntry: IntegrityHistoryEntry = {
    id: `${now().getTime()}`,
    createdAt: now().toISOString(),
    decision,
    note: trimmedNote || "No note recorded.",
  };
  const nextHistory = [nextEntry, ...item.history];
  const evidenceSummary = buildEvidenceSummary(item);

  const { error } = await supabase.from("academic_integrity_reviews").upsert(
    {
      submission_id: item.submissionId,
      lecturer_id: lecturerId,
      review_type: reviewType,
      decision,
      evidence_summary: evidenceSummary || null,
      lecturer_note: serializeReviewPayload(trimmedNote, nextHistory, {
        totalScore: item.totalScore,
        aiWritingScore: item.aiWritingScore,
        similarityScore: item.similarityScore,
        overlapBreakdown: item.overlapBreakdown,
        baselineDeviationScore: item.baselineDeviationScore,
        riskLevel: item.riskLevel,
        analysisLimited: item.analysisLimited,
        limitations: item.limitations,
        evidence: item.evidence,
        flags: item.flags,
      }),
    },
    { onConflict: "submission_id,lecturer_id" }
  );

  return { error, nextHistory };
};
