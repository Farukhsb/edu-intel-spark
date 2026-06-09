import { describe, expect, it } from "vitest";

import {
  buildIntegrityClientOutcome,
  buildIntegrityDisplayFlags,
  buildIntegrityDisplayMetrics,
  buildIntegrityDisplaySummary,
  buildIntegritySeverityLabel,
  deriveIntegrityCardPresentation,
  resolveIntegrityDisplayDisposition,
} from "@/pages/dashboard/assignment-detail/domain";
import type { PlagiarismFlag } from "@/pages/dashboard/assignment-detail/types";

const flag = (overrides: Partial<PlagiarismFlag>): PlagiarismFlag =>
  ({
    id: "flag-1",
    submission_a_id: "submission-a",
    submission_b_id: "submission-b",
    similarity_score: 0,
    ai_suspicion_score: 0,
    baseline_deviation_score: 0,
    total_risk_score: 0,
    recommended_action: "clear",
    severity: "low",
    integrity_type: "text",
    matched_excerpt: null,
    evidence_summary: null,
    overlap_analysis: null,
    ...overrides,
  } as PlagiarismFlag);

describe("assignment detail integrity UI", () => {
  it("resolves dispositions and display labels across threshold branches", () => {
    expect(resolveIntegrityDisplayDisposition(flag({ recommended_action: "investigate" }))).toBe("investigate");
    expect(resolveIntegrityDisplayDisposition(flag({ recommended_action: "review" }))).toBe("review");
    expect(resolveIntegrityDisplayDisposition(flag({ total_risk_score: 81 }))).toBe("investigate");
    expect(resolveIntegrityDisplayDisposition(flag({ similarity_score: 52 }))).toBe("review");
    expect(resolveIntegrityDisplayDisposition(flag({ total_risk_score: 12 }))).toBe("monitor");
    expect(buildIntegritySeverityLabel(flag({ total_risk_score: 81 }))).toBe("High priority");
    expect(buildIntegritySeverityLabel(flag({ total_risk_score: 52 }))).toBe("Needs review");
    expect(buildIntegritySeverityLabel(flag({ total_risk_score: 12 }))).toBe("Monitor");
  });

  it("merges duplicate flags and builds integrity summaries and outcomes", () => {
    const duplicateFlags = buildIntegrityDisplayFlags([
      flag({
        id: "flag-1",
        similarity_score: 48,
        ai_suspicion_score: 49,
        baseline_deviation_score: 32,
        total_risk_score: 51,
        recommended_action: "review",
        severity: "medium",
        integrity_type: "text",
        overlap_analysis: {
          total_overlap: 10,
          cited_overlap: 2,
          uncited_overlap: 8,
          internal_peer_overlap: 0,
          external_source_overlap: 0,
        },
        evidence_summary: "First note",
      }),
      flag({
        id: "flag-2",
        similarity_score: 80,
        ai_suspicion_score: 82,
        baseline_deviation_score: 34,
        total_risk_score: 91,
        recommended_action: "investigate",
        severity: "high",
        integrity_type: "image",
        matched_excerpt: "Excerpt",
        overlap_analysis: {
          total_overlap: 25,
          cited_overlap: 25,
          uncited_overlap: 25,
          internal_peer_overlap: 1,
          external_source_overlap: 3,
        },
        evidence_summary: "Second note",
      }),
      flag({
        id: "flag-3",
        submission_a_id: "submission-x",
        submission_b_id: "submission-y",
        total_risk_score: 30,
        similarity_score: 20,
        recommended_action: "clear",
        severity: "low",
        integrity_type: "text",
      }),
    ]);

    expect(duplicateFlags).toHaveLength(2);
    expect(duplicateFlags[0].recommended_action).toBe("investigate");
    expect(duplicateFlags[0].severity).toBe("high");
    expect(duplicateFlags[0].integrity_type).toBe("mixed");
    expect(duplicateFlags[0].evidence_summary).toContain("First note");
    expect(duplicateFlags[0].evidence_summary).toContain("Second note");

    expect(
      buildIntegrityDisplaySummary(duplicateFlags, "  Integrity analysis found a limitation warning.  "),
    ).toContain("urgent lecturer investigation");
    expect(
      buildIntegrityDisplaySummary([flag({ total_risk_score: 30 })], "  Integrity analysis found a limit warning.  "),
    ).toContain("monitoring threshold");
    expect(buildIntegrityDisplaySummary([], "  Clear result  ")).toBe("Clear result");
    expect(buildIntegrityDisplaySummary([], "   ")).toBe("");

    expect(
      buildIntegrityClientOutcome({
        flags: duplicateFlags,
        summaries: ["  One summary  ", "One summary"],
        warnings: ["  warning one  "],
        failedBatches: 1,
      }),
    ).toMatchObject({
      toastTone: "warning",
      toastMessage: "2 potential issue(s) flagged. Analysis completed with limitations.",
    });
    expect(
      buildIntegrityClientOutcome({
        flags: [],
        summaries: ["  analysis took longer than usual  "],
        warnings: [],
        failedBatches: 0,
      }),
    ).toMatchObject({
      toastTone: "warning",
      toastMessage: "Integrity analysis completed with limitations.",
    });
    expect(
      buildIntegrityClientOutcome({
        flags: [],
        summaries: [],
        warnings: [],
        failedBatches: 0,
      }),
    ).toMatchObject({
      toastTone: "success",
      toastMessage: "No suspicious similarities found",
    });

    expect(
      deriveIntegrityCardPresentation({
        flags: duplicateFlags,
        summary: "Flagged due to review threshold",
      }),
    ).toMatchObject({
      badgeLabel: "2 flag(s)",
      cardTone: "flagged",
      shouldShowCard: true,
    });
    expect(
      deriveIntegrityCardPresentation({
        flags: [],
        summary: "Contains a warning and limit marker",
      }),
    ).toMatchObject({
      badgeLabel: "Limited coverage",
      cardTone: "limited",
      shouldShowCard: true,
    });
    expect(
      deriveIntegrityCardPresentation({
        flags: [],
        summary: " ",
      }),
    ).toMatchObject({
      badgeLabel: "",
      cardTone: "clear",
      shouldShowCard: false,
    });

    expect(buildIntegrityDisplayMetrics(duplicateFlags[0])).toEqual([
      { label: "Combined score", value: "91%" },
      { label: "Similarity", value: "80%" },
      { label: "Uncited overlap", value: "25%" },
      { label: "AI-writing signal", value: "82%" },
      { label: "Writing profile shift", value: "34%" },
    ]);
  });
});
