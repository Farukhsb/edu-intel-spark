import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/helpers/mockSupabaseClient";
import { persistIntegrityDecision } from "@/lib/integrityDecisionPersistence";

describe("persistIntegrityDecision", () => {
  it("writes a lecturer integrity decision with evidence summary and history payload", async () => {
    const supabase = createSupabaseMock({
      academic_integrity_reviews: {
        upsertResult: {
          data: null,
          error: null,
        },
      },
    });

    const now = new Date("2026-04-21T12:00:00.000Z");
    const item = {
      submissionId: "submission-1",
      totalScore: 72,
      aiWritingScore: 10,
      similarityScore: 58,
      baselineDeviationScore: 0,
      riskLevel: "medium",
      analysisLimited: false,
      limitations: [],
      overlapBreakdown: {
        totalOverlap: 58,
        citedOverlap: 8,
        uncitedOverlap: 50,
        internalPeerOverlap: 30,
        externalSourceOverlap: 28,
      },
      evidence: {
        aiWriting: [],
        similarity: [{ label: "Similarity", value: "Matched body section", score: 58 }],
        uncitedMatches: [{ label: "Uncited", value: "Copied paragraph", score: 50 }],
        citedMatches: [],
        peerMatches: [],
        externalMatches: [],
        baselineDeviation: [],
      },
      flags: ["uncited_overlap"],
      history: [],
    };

    const result = await persistIntegrityDecision({
      supabase: supabase as never,
      lecturerId: "lecturer-1",
      item: item as never,
      decision: "pending",
      note: "Requires a closer lecturer review.",
      reviewType: "similarity-plagiarism-suspicion",
      now: () => now,
    });

    expect(result.error).toBeNull();
    expect(result.nextHistory).toHaveLength(1);
    expect(result.nextHistory[0]).toMatchObject({
      decision: "pending",
      note: "Requires a closer lecturer review.",
      createdAt: now.toISOString(),
    });

    const reviewTable = supabase.from.mock.results
      .map((mockResult) => mockResult.value)
      .find((value: { upsert?: ReturnType<typeof vi.fn> }) => value.upsert?.mock.calls.length);
    const [payload, options] = reviewTable.upsert.mock.calls[0];

    expect(options).toEqual({ onConflict: "submission_id,lecturer_id" });
    expect(payload).toMatchObject({
      submission_id: "submission-1",
      lecturer_id: "lecturer-1",
      review_type: "similarity-plagiarism-suspicion",
      decision: "pending",
    });
    expect(payload.evidence_summary).toContain("Similarity: Matched body section");
    expect(payload.evidence_summary).toContain("Uncited: Copied paragraph");
    expect(payload.lecturer_note).toContain("Requires a closer lecturer review.");
  });
});
