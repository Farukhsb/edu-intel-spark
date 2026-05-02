// @vitest-environment node

import { describe, expect, it } from "vitest";

import { analyzeTextSimilarity } from "../../supabase/functions/_shared/providers/internal-text-similarity";

const longRepeatedText =
  "Network security incident response requires careful timeline analysis root cause review and control improvements " +
  "across people process and technology. ".repeat(8);

describe("internal_text_similarity provider", () => {
  it("returns an analysis-limited finding for texts that are too short", () => {
    const finding = analyzeTextSimilarity(
      "Too short to compare reliably.",
      "Also too short to compare reliably.",
      "submission-a",
      "submission-b",
      "assignment-1",
    );

    expect(finding.provider).toBe("internal_text_similarity");
    expect(finding.assignment_id).toBe("assignment-1");
    expect(finding.submission_id).toBe("submission-a");
    expect(finding.compared_submission_id).toBe("submission-b");
    expect(finding.analysis_limited).toBe(true);
    expect(finding.similarity_score).toBe(0);
    expect(finding.raw_metadata).toMatchObject({
      reason: "text_too_short",
      minimum_word_count: 50,
    });
  });

  it("returns a pairwise finding with overlap evidence for comparable texts", () => {
    const finding = analyzeTextSimilarity(
      longRepeatedText,
      longRepeatedText,
      "submission-a",
      "submission-b",
      "assignment-1",
    );

    expect(finding.provider).toBe("internal_text_similarity");
    expect(finding.assignment_id).toBe("assignment-1");
    expect(finding.submission_id).toBe("submission-a");
    expect(finding.compared_submission_id).toBe("submission-b");
    expect(finding.analysis_limited).toBe(false);
    expect(finding.similarity_score).toBe(100);
    expect(finding.severity).toBe("high");
    expect(finding.matched_phrases.length).toBeGreaterThan(0);
    expect(finding.matched_phrases.length).toBeLessThanOrEqual(5);
    expect(finding.raw_metadata).toMatchObject({
      method: "jaccard_word_shingles",
      shingle_size: 8,
      compared_within_assignment_only: true,
    });
  });
});
