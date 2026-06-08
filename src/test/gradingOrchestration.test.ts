// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBatchReusedGradeResult,
  buildFinalizedGradeResult,
  buildFingerprintClusterReuseResult,
  buildGradingHistory,
  buildSavedGradeReuseResult,
} from "../../supabase/functions/grade-submission/orchestration";

describe("grade-submission orchestration helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds final grade metadata without duplicating reviewer reasons", () => {
    const result = buildFinalizedGradeResult({
      score: 78,
      feedbackParts: ["Strong structure.", "Good evidence use."],
      breakdown: [{ criterion: "Analysis", score: 18 }],
      assignmentType: "essay",
      gradingConfidence: 0.84,
      requiresLecturerReview: true,
      reviewReasons: ["Needs lecturer review", "Needs lecturer review"],
      gradingInputHash: "hash-1",
      promptVersion: "2026-06-01-v1",
      confidenceThreshold: 0.7,
      forceRegenerate: false,
      mathAnalysis: null,
      fairnessNotes: ["Band calibration applied", "Band calibration applied"],
      stabilityNotes: ["Pass spread consistent"],
      originalAiScoreBeforeValidation: 80,
      ukBand: "2:1",
      relevanceClassification: "relevant",
      relevanceReasons: ["Aligned with the brief"],
      evidenceCoverage: { citations: 2 },
      previousAiScore: 76,
      recalibrationApplied: true,
      gradingHistory: [{ previous_score: 76, new_score: 78, previous_confidence: 0.7, new_confidence: 0.84, grading_input_hash: "hash-1", prompt_version: "2026-05-25-v9", timestamp: "2026-06-08T10:00:00.000Z", reason_for_regrade: "Initial grade generation." }],
      contentFingerprint: "assignment-1:fp",
      passScores: [77, 78],
      passSpread: 1,
      passSpreadThreshold: 8,
      mainStrengths: ["Structure"],
      mainWeaknesses: ["More citation detail"],
      extractionMetadata: { extraction_success: true },
      requestDiagnostics: { phase: "final" },
    });

    expect(result.feedback).toBe("Strong structure.\n\nGood evidence use.");
    expect(result.reviewReasons).toEqual(["Needs lecturer review"]);
    expect(result.gradingMetadata).toEqual(
      expect.objectContaining({
        rubric_validated: true,
        cached_result: false,
        lecturer_review_required: true,
        grading_pass_count: 2,
        grading_pass_scores: [77, 78],
        grading_pass_spread: 1,
        content_fingerprint: "assignment-1:fp",
        extraction: { extraction_success: true },
        phase: "final",
      }),
    );
  });

  it("keeps history unchanged when the grading input hash matches and appends regrades otherwise", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T10:00:00.000Z"));

    const existingHistory = [
      {
        previous_score: 60,
        new_score: 70,
        previous_confidence: 0.6,
        new_confidence: 0.75,
        grading_input_hash: "hash-1",
        prompt_version: "2026-05-25-v9",
        timestamp: "2026-06-07T10:00:00.000Z",
        reason_for_regrade: "Initial grade generation.",
      },
    ];

    expect(
      buildGradingHistory({
        existingAiScore: null,
        existingGradingConfidence: null,
        existingHistory,
        forceRegenerate: false,
        existingHash: "hash-1",
        gradingInputHash: "hash-1",
        promptVersion: "2026-06-01-v1",
        regradeReason: "Rubric changed.",
        newScore: 75,
        newConfidence: 0.82,
        clampConfidence: (value) => Number(value),
      }),
    ).toBe(existingHistory);

    const appended = buildGradingHistory({
      existingAiScore: 70,
      existingGradingConfidence: 0.75,
      existingHistory,
      forceRegenerate: false,
      existingHash: "hash-1",
      gradingInputHash: "hash-2",
      promptVersion: "2026-06-01-v1",
      regradeReason: "Rubric changed.",
      newScore: 75,
      newConfidence: 0.82,
      clampConfidence: (value) => Number(value),
    });

    expect(appended).toHaveLength(2);
    expect(appended[1]).toEqual(
      expect.objectContaining({
        previous_score: 70,
        new_score: 75,
        grading_input_hash: "hash-2",
        prompt_version: "2026-06-01-v1",
        reason_for_regrade: "Rubric changed.",
        timestamp: "2026-06-08T10:00:00.000Z",
      }),
    );
  });

  it("reuses prior grades consistently for batch, saved, and clustered content", () => {
    const batchReuse = buildBatchReusedGradeResult({
      submissionId: "submission-1",
      gradingInputHash: "hash-1",
      promptVersion: "2026-06-01-v1",
      contentFingerprint: "assignment-1:fp",
      extractionMetadata: { extraction_success: true },
      matchingGeneratedResult: {
        score: 80,
        feedback: "Strong essay.",
        breakdown: [{ criterion: "Analysis", score: 20 }],
        assignmentType: "essay",
        gradingConfidence: 0.88,
        requiresLecturerReview: false,
        reviewReasons: ["Strong evidence"],
        gradingMetadata: { existing: true },
      },
    });
    expect(batchReuse).toMatchObject({
      score: 80,
      gradingMetadata: expect.objectContaining({
        cached_result: true,
        reused_identical_content_grade: true,
        grading_prompt_version: "2026-06-01-v1",
      }),
    });

    const savedReuse = buildSavedGradeReuseResult({
      submissionId: "submission-2",
      existingAiScore: 66,
      existingAiFeedback: "Saved result.",
      existingMetadata: { lecturer_review_required: true },
      cachedBreakdown: {
        breakdown: [{ criterion: "Analysis", score: 16, review_required: true }],
        reviewReasons: ["Borderline score"],
      },
      assignmentType: "essay",
      cachedConfidence: 0.7,
      gradingInputHash: "hash-2",
      promptVersion: "2026-06-01-v1",
      contentFingerprint: "assignment-1:fp-2",
      extractionMetadata: { extraction_success: true },
    });
    expect(savedReuse).toEqual(
      expect.objectContaining({
        score: 66,
        cacheMessage: "Using saved AI marking result. Re-grade only if submission or rubric changes.",
        gradingMetadata: expect.objectContaining({
          cached_result: true,
          final_validated_score: 66,
          grading_input_hash: "hash-2",
        }),
      }),
    );

    const fingerprintReuse = buildFingerprintClusterReuseResult({
      submissionId: "submission-3",
      existingAiScore: 72,
      existingAiFeedback: "Canonical cluster result.",
      reusedBreakdown: {
        breakdown: [{ criterion: "Analysis", score: 18, review_required: false }],
        reviewReasons: ["Cluster reuse"],
      },
      assignmentType: "essay",
      reusedConfidence: 0.8,
      clusterMismatch: true,
      reusedFromSubmissionId: "submission-source",
      duplicateClusterGradeCount: 3,
      duplicateClusterScoreSpread: 14,
      matchingClusterMetadata: { canonical: true },
      gradingInputHash: "hash-3",
      promptVersion: "2026-06-01-v1",
      contentFingerprint: "assignment-1:fp-3",
      extractionMetadata: { extraction_success: true },
    });
    expect(fingerprintReuse.gradingConfidence).toBe(0.65);
    expect(fingerprintReuse.reviewReasons).toContain(
      "Historical duplicate grades for this same content varied by 14 marks; canonical cluster grade applied.",
    );
    expect(fingerprintReuse.gradingMetadata).toEqual(
      expect.objectContaining({
        cached_result: true,
        reused_from_submission_id: "submission-source",
        duplicate_cluster_grade_count: 3,
        duplicate_cluster_score_spread: 14,
      }),
    );
  });
});
