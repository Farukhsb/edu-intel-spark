// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildIntegrityReviewUpserts,
  createIntegritySnapshot,
  ensureIntegritySnapshot,
  mergeFlagIntoSnapshot,
  persistIntegrityReviewUpserts,
  persistWritingProfiles,
  setSnapshotRiskLevel,
} from "../../supabase/functions/_shared/integrity-review-store";

const mocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/log.ts", () => ({
  logWarn: mocks.logWarn,
  logError: mocks.logError,
}));

describe("integrity review store coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers snapshot creation, merging, and review upsert building branches", () => {
    const snapshots = new Map<string, ReturnType<typeof createIntegritySnapshot>>();
    const created = ensureIntegritySnapshot(snapshots, { id: "submission-1" });
    const reused = ensureIntegritySnapshot(snapshots, { id: "submission-1" });

    expect(reused).toBe(created);
    expect(snapshots.size).toBe(1);

    created.totalScore = 55;
    setSnapshotRiskLevel(created, (score) => (score >= 80 ? "high" : score >= 50 ? "medium" : "low"));
    expect(created.riskLevel).toBe("medium");

    const highSnapshot = createIntegritySnapshot();
    highSnapshot.totalScore = 92;
    setSnapshotRiskLevel(highSnapshot, (score) => (score >= 80 ? "high" : score >= 50 ? "medium" : "low"));
    expect(highSnapshot.riskLevel).toBe("high");

    const lowSnapshot = createIntegritySnapshot();
    lowSnapshot.totalScore = 12;
    setSnapshotRiskLevel(lowSnapshot, (score) => (score >= 80 ? "high" : score >= 50 ? "medium" : "low"));
    expect(lowSnapshot.riskLevel).toBe("low");

    mergeFlagIntoSnapshot({
      snapshot: created,
      flag: {
        submission_a_id: "submission-1",
        total_risk_score: 88,
        ai_suspicion_score: 63,
        similarity_score: 71,
        baseline_deviation_score: 26,
        reason: "Repeated overlap",
        evidence_summary: "Repeated overlap summary",
        overlap_analysis: {
          total_overlap: 72,
          cited_overlap: 18,
          uncited_overlap: 30,
          internal_peer_overlap: 12,
          external_source_overlap: 7,
        },
        evidence_groups: {
          uncited_matches: [{ label: "Uncited", value: "Block A", score: 30 }],
          cited_matches: [{ label: "Cited", value: "Citation B", score: 18 }],
          peer_matches: [{ label: "Peer", value: "Peer C", score: 12 }],
          external_matches: [{ label: "External", value: "External D", score: 7 }],
        },
      },
      severityFromRisk: (score) => (score >= 80 ? "high" : score >= 50 ? "medium" : "low"),
    });

    expect(created.totalScore).toBe(88);
    expect(created.aiWritingScore).toBe(63);
    expect(created.similarityScore).toBe(71);
    expect(created.baselineDeviationScore).toBe(26);
    expect(created.riskLevel).toBe("high");
    expect(created.flags).toEqual([
      "ai writing suspicion",
      "uncited overlap",
    ]);
    expect(created.evidence.aiWriting).toHaveLength(1);
    expect(created.evidence.similarity).toHaveLength(1);
    expect(created.evidence.uncitedMatches).toHaveLength(1);
    expect(created.evidence.citedMatches).toHaveLength(1);
    expect(created.evidence.peerMatches).toHaveLength(1);
    expect(created.evidence.externalMatches).toHaveLength(1);

    const rows = buildIntegrityReviewUpserts({
      submissions: [
        { id: "submission-1" },
        { id: "submission-2" },
        { id: "submission-3" },
        { id: "submission-4" },
        { id: "submission-5" },
      ],
      snapshots: new Map([
        ["submission-1", created],
        ["submission-2", Object.assign(createIntegritySnapshot(), { baselineDeviationScore: 40 })],
        ["submission-3", Object.assign(createIntegritySnapshot(), { aiWritingScore: 25 })],
        ["submission-4", Object.assign(createIntegritySnapshot(), { aiWritingScore: 20, similarityScore: 15 })],
      ]),
      existingReviewMap: new Map([
        [
          "submission-1",
          {
            submission_id: "submission-1",
            decision: "investigate",
            lecturer_note: JSON.stringify({
              latestNote: "Keep reviewing",
              history: [{ id: "note-1" }],
            }),
          },
        ],
        [
          "submission-2",
          {
            submission_id: "submission-2",
            decision: "review",
            lecturer_note: "not-json",
          },
        ],
        [
          "submission-5",
          {
            submission_id: "submission-5",
            decision: undefined,
            lecturer_note: null,
          },
        ],
      ]),
      lecturerId: "lecturer-1",
    });

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.review_type)).toEqual([
      "mixed",
      "baseline-deviation",
      "ai-writing-suspicion",
      "mixed",
      "similarity-plagiarism-suspicion",
    ]);
    expect(rows[0].decision).toBe("investigate");
    expect(rows[1].decision).toBe("review");
    expect(rows[4].decision).toBe("pending");
    expect(rows[0].evidence_summary).toContain("AI-writing risk");
    expect(rows[1].evidence_summary).toBeNull();
    expect(JSON.parse(rows[0].lecturer_note)).toMatchObject({
      latestNote: "Keep reviewing",
      history: [{ id: "note-1" }],
    });
    expect(JSON.parse(rows[1].lecturer_note)).toMatchObject({
      latestNote: "",
      history: [],
    });
  });

  it("covers persistence success, recoverable failure, and empty payload branches", async () => {
    const recoverableSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: { message: "temporary" } }),
      })),
    };

    const fatalSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: { message: "fatal" } }),
      })),
    };

    const warnings: string[] = [];
    await persistIntegrityReviewUpserts({
      supabaseAdmin: recoverableSupabase as never,
      reviewUpserts: [{ submission_id: "submission-1" } as never],
      assignmentId: "assignment-1",
      warnings,
      isRecoverablePersistenceError: () => true,
    });

    expect(recoverableSupabase.from).toHaveBeenCalledWith("academic_integrity_reviews");
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "Failed to persist academic integrity reviews, returning analysis without persistence",
      { function: "check-plagiarism" },
    );
    expect(warnings).toEqual([
      "Integrity review records could not be stored, but analysis completed.",
    ]);

    const fatalWarnings: string[] = [];
    await persistIntegrityReviewUpserts({
      supabaseAdmin: fatalSupabase as never,
      reviewUpserts: [{ submission_id: "submission-2" } as never],
      assignmentId: "assignment-2",
      warnings: fatalWarnings,
      isRecoverablePersistenceError: () => false,
    });

    expect(mocks.logError).toHaveBeenCalledWith(
      "academic_integrity_reviews upsert failed",
      { message: "fatal" },
      {
        function: "check-plagiarism",
        assignmentId: "assignment-2",
        reviewCount: 1,
      },
    );
    expect(fatalWarnings).toEqual([
      "Integrity review records could not be stored, but analysis completed.",
    ]);

    await persistIntegrityReviewUpserts({
      supabaseAdmin: recoverableSupabase as never,
      reviewUpserts: [],
      assignmentId: "assignment-3",
      warnings: [],
      isRecoverablePersistenceError: () => true,
    });

    const profileSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: { message: "profile failed" } }),
      })),
    };

    const profileWarnings: string[] = [];
    await persistWritingProfiles({
      supabaseAdmin: profileSupabase as never,
      profileUpserts: [{ student_id: "student-1" } as never],
      assignmentId: "assignment-4",
      warnings: profileWarnings,
    });

    expect(profileSupabase.from).toHaveBeenCalledWith("student_writing_profiles");
    expect(mocks.logError).toHaveBeenCalledWith(
      "student_writing_profiles upsert failed",
      { message: "profile failed" },
      {
        function: "check-plagiarism",
        assignmentId: "assignment-4",
        profileCount: 1,
      },
    );
    expect(profileWarnings).toEqual([
      "Writing profile history could not be updated, but analysis completed.",
    ]);

    await persistWritingProfiles({
      supabaseAdmin: profileSupabase as never,
      profileUpserts: [],
      assignmentId: "assignment-5",
      warnings: [],
    });
  });
});
