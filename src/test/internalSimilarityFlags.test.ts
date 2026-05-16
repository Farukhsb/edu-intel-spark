// @vitest-environment node

import { describe, expect, it } from "vitest";

import { analyzeTextSimilarity } from "../../supabase/functions/_shared/providers/internal-text-similarity";
import { buildInternalSimilarityFlagCandidates } from "../../supabase/functions/_shared/internal-similarity-flags";

const repeatedEssay =
  "Academic integrity review requires careful evidence gathering, consistency checks, and close lecturer judgment " +
  "across drafting patterns, citation practice, and source use. ".repeat(10);

describe("internal similarity flag candidates", () => {
  it("surfaces internal-only similarity findings for the requested submission in a larger cohort", () => {
    const finding = analyzeTextSimilarity(
      repeatedEssay,
      repeatedEssay,
      "submission-b",
      "submission-c",
      "assignment-1",
    );

    const flags = buildInternalSimilarityFlagCandidates({
      findings: [finding],
      requestedSubmissionIds: new Set(["submission-c"]),
      submissions: [
        { id: "submission-a", student_name: "Student A", student_email: "a@example.com" },
        { id: "submission-b", student_name: "Student B", student_email: "b@example.com" },
        { id: "submission-c", student_name: "Student C", student_email: "c@example.com" },
      ],
    });

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      submission_a_id: "submission-c",
      submission_b_id: "submission-b",
      student_a: "Student C",
      student_b: "Student B",
      integrity_type: "similarity",
      ai_suspicion_score: 0,
      baseline_deviation_score: 0,
      recommended_action: "investigate",
      severity: "high",
    });
    expect(flags[0].similarity_score).toBeGreaterThanOrEqual(80);
    expect(flags[0].matched_excerpt.length).toBeGreaterThan(0);
  });

  it("drops findings that do not involve the requested submission set", () => {
    const finding = analyzeTextSimilarity(
      repeatedEssay,
      repeatedEssay,
      "submission-a",
      "submission-b",
      "assignment-1",
    );

    const flags = buildInternalSimilarityFlagCandidates({
      findings: [finding],
      requestedSubmissionIds: new Set(["submission-c"]),
      submissions: [
        { id: "submission-a", student_name: "Student A", student_email: "a@example.com" },
        { id: "submission-b", student_name: "Student B", student_email: "b@example.com" },
        { id: "submission-c", student_name: "Student C", student_email: "c@example.com" },
      ],
    });

    expect(flags).toEqual([]);
  });
});
