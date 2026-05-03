import {
  getAcademicIntegrityReadiness,
  buildIntegrityCases,
  buildIntegrityDrafts,
  buildIntegrityOverview,
  buildIntegrityTotals,
  getIntegrityReviewType,
} from "@/lib/integrityQueue";

describe("integrity queue mapping", () => {
  it("normalizes persisted integrity reviews into flagged cases", () => {
    const cases = buildIntegrityCases({
      assignments: [{ id: "a1", title: "Essay 1" }],
      submissions: [
        {
          id: "s1",
          assignment_id: "a1",
          student_name: "Sam Student",
          student_email: "sam@example.com",
          status: "submitted",
          submitted_at: "2026-04-01T10:00:00.000Z",
        },
      ],
      reviews: [
        {
          submission_id: "s1",
          decision: "investigate",
          updated_at: "2026-04-02T10:00:00.000Z",
          lecturer_note: JSON.stringify({
            latestNote: "Needs review",
            history: [
              {
                id: "1",
                createdAt: "2026-04-02T10:00:00.000Z",
                decision: "investigate",
                note: "Needs review",
              },
            ],
            integritySnapshot: {
              totalScore: 81,
              aiWritingScore: 35,
              similarityScore: 62,
              riskLevel: "high",
              analysisLimited: true,
              limitations: ["PDF extraction quality was low."],
              overlapBreakdown: {
                totalOverlap: 60,
                citedOverlap: 10,
                uncitedOverlap: 50,
                internalPeerOverlap: 40,
                externalSourceOverlap: 20,
              },
              evidence: {
                aiWriting: [{ label: "Stylometry", value: "Unexpected style shift", score: 35 }],
                similarity: [{ label: "Similarity", value: "Large overlap block", score: 62 }],
                uncitedMatches: [{ label: "Uncited", value: "Copied paragraph", score: 50 }],
                citedMatches: [],
                peerMatches: [],
                externalMatches: [],
                baselineDeviation: [],
              },
              flags: ["analysis_limited", "uncited_overlap"],
            },
          }),
        },
      ],
    });

    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      submissionId: "s1",
      assignment: "Essay 1",
      student: "Sam Student",
      riskLevel: "high",
      analysisLimited: true,
      totalScore: 81,
    });
    expect(cases[0].limitations).toEqual(["PDF extraction quality was low."]);
    expect(cases[0].flags).toEqual(["analysis_limited", "uncited_overlap"]);
  });

  it("drops empty pending reviews and derives overview, totals, and drafts", () => {
    const cases = buildIntegrityCases({
      assignments: [{ id: "a1", title: "Essay 1" }],
      submissions: [
        {
          id: "s1",
          assignment_id: "a1",
          student_name: null,
          student_email: "sam@example.com",
          status: "submitted",
          submitted_at: "2026-04-01T10:00:00.000Z",
        },
      ],
      reviews: [
        {
          submission_id: "s1",
          decision: "pending",
          updated_at: "2026-04-02T10:00:00.000Z",
          lecturer_note: null,
        },
      ],
    });

    expect(cases).toHaveLength(0);
    expect(buildIntegrityOverview({ submissionsScanned: 3, cases })).toEqual([
      { label: "Submissions Scanned", value: "3" },
      { label: "Flagged for Review", value: "0" },
      { label: "Open Investigations", value: "0" },
      { label: "Cleared", value: "0" },
    ]);
    expect(buildIntegrityTotals(cases)).toEqual({
      aiWriting: 0,
      similarity: 0,
      baselineDeviation: 0,
      pending: 0,
    });
    expect(buildIntegrityDrafts(cases)).toEqual({
      decisionDrafts: {},
      noteDrafts: {},
    });
  });

  it("selects the correct integrity review type", () => {
    expect(getIntegrityReviewType({ aiWritingScore: 12, similarityScore: 25, baselineDeviationScore: 0 })).toBe("mixed");
    expect(getIntegrityReviewType({ aiWritingScore: 12, similarityScore: 0, baselineDeviationScore: 0 })).toBe("ai-writing-suspicion");
    expect(getIntegrityReviewType({ aiWritingScore: 0, similarityScore: 0, baselineDeviationScore: 24 })).toBe("baseline-deviation");
    expect(getIntegrityReviewType({ aiWritingScore: 0, similarityScore: 25, baselineDeviationScore: 0 })).toBe("similarity-plagiarism-suspicion");
  });

  it("derives an integrity readiness summary from case state and totals", () => {
    const cases = buildIntegrityCases({
      assignments: [{ id: "a1", title: "Essay 1" }],
      submissions: [
        {
          id: "s1",
          assignment_id: "a1",
          student_name: "Sam Student",
          student_email: "sam@example.com",
          status: "submitted",
          submitted_at: "2026-04-01T10:00:00.000Z",
        },
      ],
      reviews: [
        {
          submission_id: "s1",
          decision: "investigate",
          updated_at: "2026-04-02T10:00:00.000Z",
          lecturer_note: JSON.stringify({
            latestNote: "Needs review",
            history: [],
            integritySnapshot: {
              totalScore: 81,
              aiWritingScore: 35,
              similarityScore: 62,
              riskLevel: "high",
              analysisLimited: false,
              limitations: [],
              overlapBreakdown: {
                totalOverlap: 60,
                citedOverlap: 10,
                uncitedOverlap: 50,
                internalPeerOverlap: 40,
                externalSourceOverlap: 20,
              },
              evidence: {
                aiWriting: [],
                similarity: [],
                uncitedMatches: [],
                citedMatches: [],
                peerMatches: [],
                externalMatches: [],
                baselineDeviation: [],
              },
              flags: [],
            },
          }),
        },
      ],
    });

    const readiness = getAcademicIntegrityReadiness({
      cases,
      totals: buildIntegrityTotals(cases),
    });

    expect(readiness.postureLabel).toBe("Escalated review position");
    expect(readiness.likelyChallenge).toBe("Essay 1");
    expect(readiness.bestNextAction).toBe("Complete active investigations and record lecturer decisions");
  });
});
