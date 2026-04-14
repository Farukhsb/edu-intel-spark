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
  riskLevel: "high" | "medium" | "low";
  evidence: {
    aiWriting: IntegrityEvidenceItem[];
    similarity: IntegrityEvidenceItem[];
  };
  flags: string[];
}

export interface StoredReviewPayload {
  latestNote: string;
  history: IntegrityHistoryEntry[];
  integritySnapshot: IntegritySnapshot | null;
}

export const parseStoredReviewPayload = (
  review: Pick<{ lecturer_note: string | null; updated_at: string; decision: string }, "lecturer_note" | "updated_at" | "decision">
): StoredReviewPayload => {
  if (!review.lecturer_note) {
    return { latestNote: "", history: [], integritySnapshot: null };
  }

  try {
    const parsed = JSON.parse(review.lecturer_note) as Partial<StoredReviewPayload>;
    if (Array.isArray(parsed.history)) {
      return {
        latestNote: typeof parsed.latestNote === "string" ? parsed.latestNote : parsed.history[0]?.note ?? "",
        history: parsed.history.filter(
          (entry): entry is IntegrityHistoryEntry =>
            !!entry &&
            typeof entry.id === "string" &&
            typeof entry.createdAt === "string" &&
            typeof entry.decision === "string" &&
            typeof entry.note === "string"
        ),
        integritySnapshot:
          parsed.integritySnapshot && typeof parsed.integritySnapshot === "object"
            ? (parsed.integritySnapshot as IntegritySnapshot)
            : null,
      };
    }
  } catch {
    return {
      latestNote: review.lecturer_note,
      history: [
        {
          id: `legacy-${review.updated_at}`,
          createdAt: review.updated_at,
          decision: review.decision as IntegrityDecision,
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
