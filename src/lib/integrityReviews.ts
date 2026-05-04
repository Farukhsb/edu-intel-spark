import { z } from "zod";

export type IntegrityDecision = "pending" | "clear" | "investigate" | "misconduct-concern";

export interface IntegrityHistoryEntry {
  id: string;
  createdAt: string;
  decision: IntegrityDecision;
  note: string;
}

export interface IntegrityEvidenceItem {
  label: string;
  value: string;
  score: number;
}

export interface IntegritySnapshot {
  totalScore: number;
  aiWritingScore: number;
  similarityScore: number;
  analysisLimited?: boolean;
  limitations?: string[];
  overlapBreakdown?: {
    totalOverlap: number;
    citedOverlap: number;
    uncitedOverlap: number;
    internalPeerOverlap: number;
    externalSourceOverlap: number;
  };
  baselineDeviationScore?: number;
  riskLevel: "high" | "medium" | "low";
  evidence: {
    aiWriting: IntegrityEvidenceItem[];
    similarity: IntegrityEvidenceItem[];
    uncitedMatches?: IntegrityEvidenceItem[];
    citedMatches?: IntegrityEvidenceItem[];
    peerMatches?: IntegrityEvidenceItem[];
    externalMatches?: IntegrityEvidenceItem[];
    baselineDeviation?: IntegrityEvidenceItem[];
  };
  flags: string[];
}

export interface StoredReviewPayload {
  latestNote: string;
  history: IntegrityHistoryEntry[];
  integritySnapshot: IntegritySnapshot | null;
}

const IntegrityDecisionSchema = z.enum(["pending", "clear", "investigate", "misconduct-concern"]);

const IntegrityHistoryEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  decision: IntegrityDecisionSchema,
  note: z.string(),
});

const IntegrityEvidenceItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  score: z.number(),
});

const IntegritySnapshotSchema: z.ZodType<IntegritySnapshot> = z.object({
  totalScore: z.number(),
  aiWritingScore: z.number(),
  similarityScore: z.number(),
  analysisLimited: z.boolean().optional(),
  limitations: z.array(z.string()).optional(),
  overlapBreakdown: z
    .object({
      totalOverlap: z.number(),
      citedOverlap: z.number(),
      uncitedOverlap: z.number(),
      internalPeerOverlap: z.number(),
      externalSourceOverlap: z.number(),
    })
    .optional(),
  baselineDeviationScore: z.number().optional(),
  riskLevel: z.enum(["high", "medium", "low"]),
  evidence: z.object({
    aiWriting: z.array(IntegrityEvidenceItemSchema),
    similarity: z.array(IntegrityEvidenceItemSchema),
    uncitedMatches: z.array(IntegrityEvidenceItemSchema).optional(),
    citedMatches: z.array(IntegrityEvidenceItemSchema).optional(),
    peerMatches: z.array(IntegrityEvidenceItemSchema).optional(),
    externalMatches: z.array(IntegrityEvidenceItemSchema).optional(),
    baselineDeviation: z.array(IntegrityEvidenceItemSchema).optional(),
  }),
  flags: z.array(z.string()),
});

const StoredReviewPayloadSchema = z.object({
  latestNote: z.string().optional(),
  history: z.array(IntegrityHistoryEntrySchema).catch([]),
  integritySnapshot: z.unknown().optional(),
});

export const parseStoredReviewPayload = (
  review: Pick<{ lecturer_note: string | null; updated_at: string; decision: string }, "lecturer_note" | "updated_at" | "decision">
): StoredReviewPayload => {
  if (!review.lecturer_note) {
    return { latestNote: "", history: [], integritySnapshot: null };
  }

  try {
    const parsed = StoredReviewPayloadSchema.safeParse(JSON.parse(review.lecturer_note));
    if (parsed.success) {
      const integritySnapshot = IntegritySnapshotSchema.nullable().safeParse(parsed.data.integritySnapshot);

      return {
        latestNote: parsed.data.latestNote ?? parsed.data.history[0]?.note ?? "",
        history: parsed.data.history,
        integritySnapshot: integritySnapshot.success ? integritySnapshot.data : null,
      };
    }
  } catch {
    return {
      latestNote: review.lecturer_note,
      history: [
        {
          id: `legacy-${review.updated_at}`,
          createdAt: review.updated_at,
          decision: IntegrityDecisionSchema.safeParse(review.decision).success
            ? IntegrityDecisionSchema.parse(review.decision)
            : "pending",
          note: review.lecturer_note,
        },
      ],
      integritySnapshot: null,
    };
  }

  return { latestNote: "", history: [], integritySnapshot: null };
};

export const serializeReviewPayload = (
  latestNote: string,
  history: IntegrityHistoryEntry[],
  integritySnapshot: IntegritySnapshot | null
) =>
  JSON.stringify({
    latestNote,
    history,
    integritySnapshot,
  });

export const clampRiskLevel = (score: number): IntegritySnapshot["riskLevel"] =>
  score >= 80 ? "high" : score >= 55 ? "medium" : "low";
