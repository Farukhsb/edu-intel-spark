import { describe, expect, it } from "vitest";

import { parseStoredReviewPayload } from "@/lib/integrityReviews";

describe("integrityReviews", () => {
  it("keeps valid stored review payloads and drops invalid snapshot shapes", () => {
    const validPayload = parseStoredReviewPayload({
      lecturer_note: JSON.stringify({
        latestNote: "Needs citation review",
        history: [
          {
            id: "history-1",
            createdAt: "2026-05-04T09:00:00.000Z",
            decision: "investigate",
            note: "Needs citation review",
          },
        ],
        integritySnapshot: {
          totalScore: 82,
          aiWritingScore: 61,
          similarityScore: 74,
          riskLevel: "high",
          evidence: {
            aiWriting: [{ label: "Style drift", value: "Large", score: 61 }],
            similarity: [{ label: "Peer overlap", value: "74%", score: 74 }],
          },
          flags: ["peer overlap"],
        },
      }),
      updated_at: "2026-05-04T09:00:00.000Z",
      decision: "investigate",
    });

    const invalidSnapshotPayload = parseStoredReviewPayload({
      lecturer_note: JSON.stringify({
        latestNote: "Snapshot shape is stale",
        history: [
          {
            id: "history-2",
            createdAt: "2026-05-04T10:00:00.000Z",
            decision: "clear",
            note: "Snapshot shape is stale",
          },
        ],
        integritySnapshot: {
          totalScore: "bad",
        },
      }),
      updated_at: "2026-05-04T10:00:00.000Z",
      decision: "clear",
    });

    expect(validPayload.latestNote).toBe("Needs citation review");
    expect(validPayload.history).toHaveLength(1);
    expect(validPayload.integritySnapshot?.riskLevel).toBe("high");

    expect(invalidSnapshotPayload.latestNote).toBe("Snapshot shape is stale");
    expect(invalidSnapshotPayload.history).toHaveLength(1);
    expect(invalidSnapshotPayload.integritySnapshot).toBeNull();
  });

  it("falls back to legacy note history when lecturer_note is plain text", () => {
    const payload = parseStoredReviewPayload({
      lecturer_note: "Legacy manual note",
      updated_at: "2026-05-04T11:00:00.000Z",
      decision: "unknown",
    });

    expect(payload).toEqual({
      latestNote: "Legacy manual note",
      history: [
        {
          id: "legacy-2026-05-04T11:00:00.000Z",
          createdAt: "2026-05-04T11:00:00.000Z",
          decision: "pending",
          note: "Legacy manual note",
        },
      ],
      integritySnapshot: null,
    });
  });
});
