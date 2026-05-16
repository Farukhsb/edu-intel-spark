// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildIntegrityReviewUpserts,
  createIntegritySnapshot,
} from "../../supabase/functions/_shared/integrity-review-store";

describe("integrity review store", () => {
  it("preserves usable latestNote/history when existing lecturer_note contains malformed snapshot JSON", () => {
    const snapshot = createIntegritySnapshot();
    snapshot.totalScore = 76;
    snapshot.similarityScore = 76;
    snapshot.riskLevel = "high";
    snapshot.evidence.similarity.push({
      label: "Similarity overlap",
      value: "Peer overlap flagged",
      score: 76,
    });

    const rows = buildIntegrityReviewUpserts({
      submissions: [{ id: "submission-1" }],
      snapshots: new Map([["submission-1", snapshot]]),
      existingReviewMap: new Map([
        [
          "submission-1",
          {
            submission_id: "submission-1",
            decision: "investigate",
            lecturer_note: JSON.stringify({
              latestNote: "Existing lecturer note",
              history: [{ id: "note-1", note: "Existing lecturer note" }],
              integritySnapshot: { bad: "stale" },
            }),
          },
        ],
      ]),
      lecturerId: "lecturer-1",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].decision).toBe("investigate");

    const parsedNote = JSON.parse(rows[0].lecturer_note) as {
      latestNote: string;
      history: Array<{ id: string; note: string }>;
      integritySnapshot: { totalScore: number };
    };

    expect(parsedNote.latestNote).toBe("Existing lecturer note");
    expect(parsedNote.history).toEqual([{ id: "note-1", note: "Existing lecturer note" }]);
    expect(parsedNote.integritySnapshot.totalScore).toBe(76);
  });
});
