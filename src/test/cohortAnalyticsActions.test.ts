import { describe, expect, it } from "vitest";

import {
  getRecommendationActionSummary,
  type RecommendationActionSummary,
} from "@/pages/dashboard/cohort-analytics/useCohortAnalyticsController";
import type { CohortRecommendation } from "@/lib/cohortRecommendations";

const buildRecommendation = (
  overrides: Partial<CohortRecommendation> = {},
): CohortRecommendation => ({
  id: "recommendation-1",
  type: "student risk",
  ruleCode: "high_risk_student_cluster",
  title: "High-risk student cluster detected",
  summary: "3 students are in the high or critical risk band.",
  explanation: "The trajectory-based risk engine is flagging a meaningful cluster size.",
  severity: "critical",
  confidence: 0.92,
  recommendedActions: ["Open the risk workflow and prioritise the highest-risk students."],
  evidence: {
    metrics: [{ label: "High-risk students", value: "3" }],
    affectedStudentIds: ["student-1", "student-2", "student-3"],
    affectedStudentNames: ["Ada Lovelace", "Grace Hopper", "Mary Jackson"],
  },
  status: "open",
  createdAt: "2026-05-10T09:00:00.000Z",
  assignmentId: null,
  ...overrides,
});

describe("cohort analytics recommendation handoff", () => {
  it("turns open student-risk recommendations into intervention-ready work", () => {
    const summary = getRecommendationActionSummary(buildRecommendation());

    expect(summary).toEqual<RecommendationActionSummary>({
      headline: "Intervention candidates ready",
      detail: "3 named students can be moved straight into the intervention loop from this recommendation.",
      primaryLabel: "Create intervention loop",
    });
  });

  it("turns actioned student-risk recommendations into follow-up queue work", () => {
    const summary = getRecommendationActionSummary(
      buildRecommendation({
        status: "actioned",
      }),
    );

    expect(summary).toEqual<RecommendationActionSummary>({
      headline: "Intervention loop is live",
      detail:
        "Intervention records were created for 3 students. Open the performance queue and confirm each follow-up is scheduled, contacted, or resolved.",
      primaryLabel: "Open follow-up queue",
    });
  });

  it("routes integrity recommendations into integrity review operations", () => {
    const summary = getRecommendationActionSummary(
      buildRecommendation({
        type: "integrity alerts",
        assignmentId: "assignment-1",
      }),
    );

    expect(summary).toEqual<RecommendationActionSummary>({
      headline: "Integrity review required",
      detail: "Open the integrity queue, inspect the flagged submissions, and decide whether to investigate or clear them.",
      primaryLabel: "Open integrity review",
    });
  });
});
