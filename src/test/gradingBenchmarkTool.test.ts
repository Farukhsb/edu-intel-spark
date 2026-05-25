import { describe, expect, it } from "vitest";

import {
  buildBenchmarkReport,
  getGradeBandLabel,
  renderMarkdownReport,
} from "../../tools/grading-benchmark/score-benchmark-lib.mjs";
import fixture from "../../benchmarks/database-normalisation-benchmark.json";

describe("grading benchmark scoring", () => {
  it("maps scores to the configured grade bands", () => {
    expect(getGradeBandLabel(fixture, 79)).toBe("First");
    expect(getGradeBandLabel(fixture, 65)).toBe("Upper Second");
    expect(getGradeBandLabel(fixture, 58)).toBe("Lower Second");
    expect(getGradeBandLabel(fixture, 45)).toBe("Third / Pass");
    expect(getGradeBandLabel(fixture, 20)).toBe("Fail");
  });

  it("reports summary metrics, score deltas, and band matches", () => {
    const results = new Map([
      ["benchmark-dbnorm-01", { aiScore: 74, notes: "" }],
      ["benchmark-dbnorm-02", { aiScore: 68, notes: "" }],
      ["benchmark-dbnorm-03", { aiScore: 52, notes: "Harsh on trade-offs." }],
    ]);

    const report = buildBenchmarkReport(fixture, results);

    expect(report.summary.comparedRows).toBe(3);
    expect(report.summary.meanAbsoluteError).toBe(4.67);
    expect(report.summary.meanSignedError).toBe(-4.67);
    expect(report.summary.withinFiveCount).toBe(2);
    expect(report.summary.withinTenCount).toBe(2);
    expect(report.summary.exactBandMatches).toBe(2);
    expect(report.summary.overscoredCount).toBe(0);
    expect(report.summary.underscoredCount).toBe(2);

    expect(report.rows[0]).toMatchObject({
      submissionId: "benchmark-dbnorm-01",
      expectedBand: "First",
      aiBand: "First",
      absoluteError: 2,
      signedDelta: -2,
      bandMatch: true,
    });

    expect(report.rows[2]).toMatchObject({
      submissionId: "benchmark-dbnorm-03",
      expectedBand: "Upper Second",
      aiBand: "Lower Second",
      absoluteError: 12,
      signedDelta: -12,
      bandMatch: false,
      notes: "Harsh on trade-offs.",
    });
  });

  it("renders a markdown report with the expanded benchmark summary", () => {
    const report = buildBenchmarkReport(
      fixture,
      new Map([["benchmark-dbnorm-01", { aiScore: 76, notes: "" }]]),
    );

    const markdown = renderMarkdownReport(fixture, report);

    expect(markdown).toContain("| Submission ID | Expected Score | Expected Band | AI Score | AI Band |");
    expect(markdown).toContain("- Mean absolute error: 0");
    expect(markdown).toContain("- Exact grade-band matches: 1/1 (100%)");
    expect(markdown).toContain("- Overscored rows: 0");
    expect(markdown).toContain("- Underscored rows: 0");
  });
});
