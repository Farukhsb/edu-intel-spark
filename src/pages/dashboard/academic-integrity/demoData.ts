import type { FlaggedIntegrityCase } from "@/lib/integrityQueue";

export const DEMO_INTEGRITY_CASES: FlaggedIntegrityCase[] = [
  {
    submissionId: "demo-submission-integrity-1",
    assignmentId: "demo-assignment-policy-brief",
    assignment: "Strategic Policy Brief: Housing Affordability Interventions",
    student: "Amina Hassan",
    submittedAt: "2026-04-11T09:00:00.000Z",
    status: "released",
    riskLevel: "medium",
    totalScore: 42,
    aiWritingScore: 38,
    similarityScore: 46,
    baselineDeviationScore: 31,
    flags: ["AI phrasing drift", "Moderate source overlap"],
    analysisLimited: false,
    limitations: [],
    decision: "pending",
    evidence: {
      aiWriting: [
        {
          label: "Stylistic variance",
          score: 41,
          value: "Sentence rhythm differs from earlier low-stakes writing samples.",
        },
      ],
      similarity: [
        {
          label: "External overlap",
          score: 46,
          value: "Policy background phrasing partially overlaps with publicly available briefing material.",
        },
      ],
      uncitedMatches: [
        {
          label: "Uncited overlap",
          score: 34,
          value: "A short policy-context paragraph should be paraphrased more clearly.",
        },
      ],
      citedMatches: [
        {
          label: "Properly cited material",
          score: 12,
          value: "Quoted and referenced evidence has been separated from the flagged uncited overlap.",
        },
      ],
      peerMatches: [],
      externalMatches: [
        {
          label: "External source match",
          score: 46,
          value: "Overlap detected against policy commentary websites, not internal peer work.",
        },
      ],
      baselineDeviation: [
        {
          label: "Writing baseline",
          score: 31,
          value: "Register is more compressed and formal than prior drafts, but still plausibly student-authored.",
        },
      ],
    },
    overlapBreakdown: {
      totalOverlap: 22,
      uncitedOverlap: 14,
      citedOverlap: 8,
      internalPeerOverlap: 0,
      externalSourceOverlap: 22,
    },
    history: [],
  },
  {
    submissionId: "demo-submission-integrity-2",
    assignmentId: "demo-assignment-ethics-review",
    assignment: "Research Ethics Review Memo",
    student: "Daniel Reed",
    submittedAt: "2026-04-09T14:30:00.000Z",
    status: "approved",
    riskLevel: "high",
    totalScore: 67,
    aiWritingScore: 58,
    similarityScore: 72,
    baselineDeviationScore: 49,
    flags: ["High uncited overlap", "Escalate for investigation"],
    analysisLimited: false,
    limitations: [],
    decision: "investigate",
    evidence: {
      aiWriting: [
        {
          label: "Register shift",
          score: 58,
          value: "The tone is markedly more polished than earlier in-course submissions.",
        },
      ],
      similarity: [
        {
          label: "Uncited overlap cluster",
          score: 72,
          value: "Substantial uncited similarity appears in the methodology and governance sections.",
        },
      ],
      uncitedMatches: [
        {
          label: "Methodology overlap",
          score: 72,
          value: "Multiple passages closely match open teaching materials without explicit attribution.",
        },
      ],
      citedMatches: [],
      peerMatches: [],
      externalMatches: [
        {
          label: "External source overlap",
          score: 64,
          value: "Overlap appears against publicly indexed ethics-guidance examples.",
        },
      ],
      baselineDeviation: [
        {
          label: "Baseline deviation",
          score: 49,
          value: "Baseline change is notable but secondary to the similarity evidence.",
        },
      ],
    },
    overlapBreakdown: {
      totalOverlap: 35,
      uncitedOverlap: 28,
      citedOverlap: 7,
      internalPeerOverlap: 0,
      externalSourceOverlap: 35,
    },
    history: [
      {
        id: "demo-history-1",
        decision: "investigate",
        note: "Escalated in the demo workflow because uncited overlap is concentrated in core analytical sections.",
        createdAt: "2026-04-16T10:00:00.000Z",
      },
    ],
  },
];
