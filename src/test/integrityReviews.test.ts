import { describe, expect, it } from "vitest";

import { getIntegrityReviewSummary, parseStoredReviewPayload } from "@/lib/integrityReviews";

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

  it("derives a shared integrity review summary for risk and flagging decisions", () => {
    const highRiskSummary = getIntegrityReviewSummary({
      lecturer_note: JSON.stringify({
        latestNote: "Investigate the overlap",
        history: [],
        integritySnapshot: {
          totalScore: 76,
          aiWritingScore: 22,
          similarityScore: 76,
          riskLevel: "high",
          evidence: {
            aiWriting: [],
            similarity: [{ label: "Peer overlap", value: "Substantial", score: 76 }],
          },
          flags: ["peer overlap"],
        },
      }),
      updated_at: "2026-05-10T10:00:00.000Z",
      decision: "pending",
    });

    const decisionFlaggedSummary = getIntegrityReviewSummary({
      lecturer_note: "Manual escalation without snapshot",
      updated_at: "2026-05-10T11:00:00.000Z",
      decision: "misconduct-concern",
    });

    expect(highRiskSummary.riskScore).toBe(76);
    expect(highRiskSummary.flagged).toBe(true);
    expect(highRiskSummary.payload.latestNote).toBe("Investigate the overlap");

    expect(decisionFlaggedSummary.riskScore).toBe(0);
    expect(decisionFlaggedSummary.flagged).toBe(true);
    expect(decisionFlaggedSummary.payload.latestNote).toBe("Manual escalation without snapshot");
  });
});
