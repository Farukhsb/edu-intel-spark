// @vitest-environment node

import { describe, expect, it } from "vitest";

import { analyzeTextSimilarity } from "../../supabase/functions/_shared/providers/internal-text-similarity";
import {
  INTERNAL_TEXT_SIMILARITY_BENCHMARK_CASES,
  type SimilarityBenchmarkCase,
} from "./fixtures/internalTextSimilarityBenchmark";

type BenchmarkResult = {
  passedChecks: number;
  totalChecks: number;
  scorePercent: number;
  byCase: Array<{
    id: string;
    label: string;
    similarityScore: number;
    analysisLimited: boolean;
    checksPassed: number;
    checksTotal: number;
    risk: SimilarityBenchmarkCase["risk"];
  }>;
};

function evaluateBenchmark(): BenchmarkResult {
  let passedChecks = 0;
  let totalChecks = 0;

  const byCase = INTERNAL_TEXT_SIMILARITY_BENCHMARK_CASES.map((benchmarkCase) => {
    const finding = analyzeTextSimilarity(
      benchmarkCase.submissionA,
      benchmarkCase.submissionB,
      `${benchmarkCase.id}-a`,
      `${benchmarkCase.id}-b`,
      "benchmark-assignment",
    );

    let checksPassed = 0;
    let checksTotal = 0;

    if (benchmarkCase.expected.analysisLimited !== undefined) {
      checksTotal += 1;
      if (finding.analysis_limited === benchmarkCase.expected.analysisLimited) {
        checksPassed += 1;
      }
    }

    if (benchmarkCase.expected.minScore !== undefined) {
      checksTotal += 1;
      if (finding.similarity_score >= benchmarkCase.expected.minScore) {
        checksPassed += 1;
      }
    }

    if (benchmarkCase.expected.maxScore !== undefined) {
      checksTotal += 1;
      if (finding.similarity_score <= benchmarkCase.expected.maxScore) {
        checksPassed += 1;
      }
    }

    passedChecks += checksPassed;
    totalChecks += checksTotal;

    return {
      id: benchmarkCase.id,
      label: benchmarkCase.label,
      similarityScore: finding.similarity_score,
      analysisLimited: finding.analysis_limited,
      checksPassed,
      checksTotal,
      risk: benchmarkCase.risk,
    };
  });

  return {
    passedChecks,
    totalChecks,
    scorePercent: totalChecks === 0 ? 0 : Math.round((passedChecks / totalChecks) * 100),
    byCase,
  };
}

describe("internal_text_similarity benchmark harness", () => {
  it("meets the current benchmark expectations and exposes known gaps clearly", () => {
    const result = evaluateBenchmark();

    expect(result.totalChecks).toBeGreaterThan(0);
    expect(result.scorePercent).toBeGreaterThanOrEqual(70);

    const directCopy = result.byCase.find((entry) => entry.id === "direct-copy");
    const paraphrase = result.byCase.find((entry) => entry.id === "paraphrase");
    const shortText = result.byCase.find((entry) => entry.id === "short-text");

    expect(directCopy?.similarityScore).toBeGreaterThanOrEqual(95);
    expect(paraphrase?.similarityScore).toBeGreaterThanOrEqual(10);
    expect(paraphrase?.similarityScore).toBeLessThanOrEqual(45);
    expect(shortText?.analysisLimited).toBe(true);
  });
});
