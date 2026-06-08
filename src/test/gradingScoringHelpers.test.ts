// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildGradingCandidate,
  buildGradingInputHash,
  chooseCanonicalFingerprintGrade,
  detectPositiveFeedbackLowScoreMismatch,
  hasMeaningfulScoreDrift,
  normalizeHistory,
} from "../../supabase/functions/grade-submission/scoring-helpers";
import type { RubricCriterion } from "../../supabase/functions/grade-submission/prompting";

describe("grading scoring helpers", () => {
  it("hashes inputs consistently and normalizes grading history", async () => {
    const rubric: RubricCriterion[] = [{ criterion: "Analysis", weight: 20, description: "Analyse the work." }];
    const first = await buildGradingInputHash({
      submissionText: "Answer",
      rubric,
      assignmentInstructions: "Explain the approach",
      maxScore: 20,
    });
    const second = await buildGradingInputHash({
      submissionText: "Answer",
      rubric,
      assignmentInstructions: "Explain the approach",
      maxScore: 20,
    });
    expect(first).toBe(second);

    expect(
      normalizeHistory({
        grading_history: [
          {
            previous_score: "10",
            new_score: 12,
            previous_confidence: "0.5",
            new_confidence: 0.8,
            grading_input_hash: "abc",
            prompt_version: 9,
          },
          null,
          { grading_input_hash: "" },
        ],
      }),
    ).toEqual([
      {
        previous_score: 10,
        new_score: 12,
        previous_confidence: 0.5,
        new_confidence: 0.8,
        grading_input_hash: "abc",
        prompt_version: "",
        timestamp: "",
        reason_for_regrade: "",
      },
    ]);
  });

  it("detects mismatched feedback and selects the canonical fingerprint grade", () => {
    expect(detectPositiveFeedbackLowScoreMismatch("Solid report with strong evidence.", 6, 20)).toBe(true);
    expect(hasMeaningfulScoreDrift(10, 22, 100)).toBe(true);

    const candidate = buildGradingCandidate(
      {
        score: 40,
        total_score: 40,
        feedback: "Clear work with solid evidence.",
        criteria: [
          {
            criterion_name: "Analysis",
            awarded_score: 20,
            max_score: 20,
            reason_for_score: "Clear work.",
            evidence_from_submission: ["Clear evidence"],
            confidence_score: 0.8,
          },
        ],
      },
      [{ criterion: "Analysis", weight: 20, description: "Analyse the work." }],
      100,
    );

    expect(candidate.normalized.total).toBe(20);
    expect(candidate.modelFeedback).toContain("Clear work");

    const cluster = chooseCanonicalFingerprintGrade([
      {
        id: "g1",
        submission_id: "s1",
        ai_score: 70,
        ai_feedback: "ok",
        ai_breakdown: [],
        grading_confidence: 0.6,
        grading_metadata: { content_fingerprint: "fp" },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "g2",
        submission_id: "s1",
        ai_score: 70,
        ai_feedback: "ok",
        ai_breakdown: [],
        grading_confidence: 0.9,
        grading_metadata: { content_fingerprint: "fp" },
        created_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "g3",
        submission_id: "s1",
        ai_score: 80,
        ai_feedback: "ok",
        ai_breakdown: [],
        grading_confidence: 0.1,
        grading_metadata: { content_fingerprint: "fp" },
        created_at: "2026-01-03T00:00:00Z",
      },
    ]);

    expect(cluster?.canonicalGrade.id).toBe("g2");
    expect(cluster?.gradeCount).toBe(3);
  });
});
