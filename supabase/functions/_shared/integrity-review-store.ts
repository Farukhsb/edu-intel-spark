import { logError, logWarn } from "./log.ts";
import { z } from "npm:zod";

export type IntegrityEvidenceItem = { label: string; value: string; score: number };

export type IntegritySnapshot = {
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
    aiWriting: IntegrityEvidenceItem[];
    similarity: IntegrityEvidenceItem[];
    baselineDeviation: IntegrityEvidenceItem[];
    uncitedMatches: IntegrityEvidenceItem[];
    citedMatches: IntegrityEvidenceItem[];
    peerMatches: IntegrityEvidenceItem[];
    externalMatches: IntegrityEvidenceItem[];
  };
  flags: string[];
};

export interface SubmissionIdentity {
  id: string;
}

export interface ExistingReviewRow {
  submission_id: string;
  decision?: unknown;
  lecturer_note?: unknown;
}

export interface ReviewUpsertRow {
  submission_id: string;
  lecturer_id: string;
  review_type: string;
  decision: string;
  evidence_summary: string | null;
  lecturer_note: string;
}

export interface ProfileUpsertRow extends Record<string, unknown> {
  student_id: string;
}

export interface IntegrityFlagLike {
  submission_a_id: string;
  total_risk_score: number;
  ai_suspicion_score: number;
  similarity_score: number;
  baseline_deviation_score: number;
  reason: string;
  evidence_summary: string;
  overlap_analysis?: {
    total_overlap?: number;
    cited_overlap?: number;
    uncited_overlap?: number;
    internal_peer_overlap?: number;
    external_source_overlap?: number;
  };
  evidence_groups?: {
    uncited_matches?: IntegrityEvidenceItem[];
    cited_matches?: IntegrityEvidenceItem[];
    peer_matches?: IntegrityEvidenceItem[];
    external_matches?: IntegrityEvidenceItem[];
  };
}

const ExistingNotePayloadSchema = z.object({
  latestNote: z.string().catch(""),
  history: z.array(z.unknown()).catch([]),
});

export const createIntegritySnapshot = (): IntegritySnapshot => ({
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
  limitations: [],
  riskLevel: "low",
  evidence: {
    aiWriting: [],
    similarity: [],
    baselineDeviation: [],
    uncitedMatches: [],
    citedMatches: [],
    peerMatches: [],
    externalMatches: [],
  },
  flags: [],
});

export const ensureIntegritySnapshot = (
  snapshots: Map<string, IntegritySnapshot>,
  submission: SubmissionIdentity,
) => {
  const existing = snapshots.get(submission.id);
  if (existing) return existing;
  const next = createIntegritySnapshot();
  snapshots.set(submission.id, next);
  return next;
};

export const setSnapshotRiskLevel = (
  snapshot: IntegritySnapshot,
  severityFromRisk: (score: number) => "low" | "medium" | "high",
) => {
  snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
    ? "high"
    : severityFromRisk(snapshot.totalScore) === "medium"
      ? "medium"
      : "low";
};

export const mergeFlagIntoSnapshot = ({
  snapshot,
  flag,
  severityFromRisk,
}: {
  snapshot: IntegritySnapshot;
  flag: IntegrityFlagLike;
  severityFromRisk: (score: number) => "low" | "medium" | "high";
}) => {
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
  setSnapshotRiskLevel(snapshot, severityFromRisk);

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
};

const parseExistingNotePayload = (raw: unknown) => {
  if (typeof raw !== "string") {
    return { latestNote: "", history: [] as unknown[] };
  }

  try {
    const parsed = ExistingNotePayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { latestNote: "", history: [] as unknown[] };
  } catch {
    return { latestNote: "", history: [] as unknown[] };
  }
};

const summarizeSnapshotEvidence = (snapshot: IntegritySnapshot | null) =>
  snapshot
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
    : null;

const resolveReviewType = (snapshot: IntegritySnapshot | null) =>
  snapshot && snapshot.baselineDeviationScore > 0 && snapshot.aiWritingScore === 0 && snapshot.similarityScore === 0
    ? "baseline-deviation"
    : snapshot && snapshot.aiWritingScore > 0 && snapshot.similarityScore > 0
      ? "mixed"
      : snapshot && snapshot.aiWritingScore > 0
        ? "ai-writing-suspicion"
        : "similarity-plagiarism-suspicion";

export const buildIntegrityReviewUpserts = ({
  submissions,
  snapshots,
  existingReviewMap,
  lecturerId,
}: {
  submissions: SubmissionIdentity[];
  snapshots: Map<string, IntegritySnapshot>;
  existingReviewMap: Map<string, ExistingReviewRow>;
  lecturerId: string;
}) =>
  submissions
    .map((submission) => {
      const snapshot = snapshots.get(submission.id) || null;
      const existingReview = existingReviewMap.get(submission.id);
      if (!snapshot && !existingReview) return null;

      const notePayload = parseExistingNotePayload(existingReview?.lecturer_note);

      return {
        submission_id: submission.id,
        lecturer_id: lecturerId,
        review_type: resolveReviewType(snapshot),
        decision: String(existingReview?.decision || "pending"),
        evidence_summary: summarizeSnapshotEvidence(snapshot),
        lecturer_note: JSON.stringify({
          latestNote: notePayload.latestNote,
          history: notePayload.history,
          integritySnapshot: snapshot,
        }),
      } satisfies ReviewUpsertRow;
    })
    .filter((row): row is ReviewUpsertRow => row !== null);

export async function persistIntegrityReviewUpserts({
  supabaseAdmin,
  reviewUpserts,
  assignmentId,
  warnings,
  isRecoverablePersistenceError,
}: {
  supabaseAdmin: {
    from: (table: "academic_integrity_reviews") => {
      upsert: (
        values: ReviewUpsertRow[],
        options: { onConflict: string },
      ) => Promise<{ error: unknown }>;
    };
  };
  reviewUpserts: ReviewUpsertRow[];
  assignmentId: string | null;
  warnings: string[];
  isRecoverablePersistenceError: (error: unknown) => boolean;
}) {
  if (reviewUpserts.length === 0) return;

  const { error: persistError } = await supabaseAdmin
    .from("academic_integrity_reviews")
    .upsert(reviewUpserts, { onConflict: "submission_id,lecturer_id" });

  if (!persistError) return;

  if (isRecoverablePersistenceError(persistError)) {
    logWarn("Failed to persist academic integrity reviews, returning analysis without persistence", {
      function: "check-plagiarism",
    });
  } else {
    logError("academic_integrity_reviews upsert failed", persistError, {
      function: "check-plagiarism",
      assignmentId,
      reviewCount: reviewUpserts.length,
    });
  }
  warnings.push("Integrity review records could not be stored, but analysis completed.");
}

export async function persistWritingProfiles({
  supabaseAdmin,
  profileUpserts,
  assignmentId,
  warnings,
}: {
  supabaseAdmin: {
    from: (table: "student_writing_profiles") => {
      upsert: (
        values: ProfileUpsertRow[],
        options: { onConflict: string },
      ) => Promise<{ error: unknown }>;
    };
  };
  profileUpserts: ProfileUpsertRow[];
  assignmentId: string | null;
  warnings: string[];
}) {
  if (profileUpserts.length === 0) return;

  const { error: profileError } = await supabaseAdmin
    .from("student_writing_profiles")
    .upsert(profileUpserts, { onConflict: "student_id" });

  if (!profileError) return;

  logError("student_writing_profiles upsert failed", profileError, {
    function: "check-plagiarism",
    assignmentId,
    profileCount: profileUpserts.length,
  });
  warnings.push("Writing profile history could not be updated, but analysis completed.");
}
