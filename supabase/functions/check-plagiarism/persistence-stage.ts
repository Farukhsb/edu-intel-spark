import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { DOCUMENT_EXTRACTION_ERROR_MESSAGE } from "../_shared/document-extraction.ts";
import { computeBaselineDeviation, computeWritingProfileMetrics, mergeWritingProfile, type EvidenceItem, type IntegrityFlag, type ProcessedSubmissionText, type StoredWritingProfile, type SubmissionRow, type WritingProfileMetrics } from "../_shared/text-analysis.ts";
import type { IntegrityProviderFinding } from "../_shared/integrity-provider.ts";
import { upsertIntegrityFindings } from "../_shared/integrity-findings-store.ts";
import { actionFromRisk, computeRisk, crossesIntegrityThreshold, isRecoverablePersistenceError, severityFromRisk } from "./analysis.ts";
import { ExistingReviewNoteSchema, type AdminSupabaseClient } from "./request.ts";
import { categorizeIntegrityWarnings as sharedCategorizeIntegrityWarnings } from "./response.ts";
import { fetchFileContent as sharedFetchFileContent } from "./extraction.ts";

type SubmissionContent = Awaited<ReturnType<typeof sharedFetchFileContent>>;

const MIN_INTEGRITY_FLAG_SCORE = 25;

type SubmissionSnapshot = {
  totalScore: number;
  aiWritingScore: number;
  similarityScore: number;
  overlapBreakdown: {
    totalOverlap: number;
    citedOverlap: number;
    uncitedOverlap: number;
    internalPeerOverlap: number;
    externalSourceOverlap: number;
  };
  baselineDeviationScore: number;
  analysisLimited: boolean;
  limitations: string[];
  riskLevel: "high" | "medium" | "low";
  evidence: {
    aiWriting: Array<{ label: string; value: string; score: number }>;
    similarity: Array<{ label: string; value: string; score: number }>;
    baselineDeviation: Array<{ label: string; value: string; score: number }>;
    uncitedMatches: EvidenceItem[];
    citedMatches: EvidenceItem[];
    peerMatches: EvidenceItem[];
    externalMatches: EvidenceItem[];
  };
  flags: string[];
};

export type FinalizeCheckPlagiarismRunInput = {
  supabaseAdmin: AdminSupabaseClient;
  user: { id: string };
  requestedAssignmentId: string;
  submissions: SubmissionRow[];
  comparisonSubmissions: SubmissionRow[];
  contentMap: Map<string, SubmissionContent>;
  processedContentMap: Map<string, ProcessedSubmissionText>;
  profileMap: Map<string, StoredWritingProfile>;
  gradeMap: Map<string, number>;
  submissionIdsByStudent: Map<string, string[]>;
  mergedFlags: IntegrityFlag[];
  internalFindings: IntegrityProviderFinding[];
  mossFindings: IntegrityProviderFinding[];
  warnings: string[];
  startedAt: number;
  summary: string;
  corsHeaders: Record<string, string>;
};

export async function finalizeCheckPlagiarismRun(input: FinalizeCheckPlagiarismRunInput) {
  const {
    supabaseAdmin,
    user,
    requestedAssignmentId,
    submissions,
    comparisonSubmissions,
    contentMap,
    processedContentMap,
    profileMap,
    gradeMap,
    submissionIdsByStudent,
    mergedFlags,
    internalFindings,
    mossFindings,
    warnings,
    startedAt,
    summary,
    corsHeaders,
  } = input;

  const similarityBySubmission = new Map<string, number>();
  const aiBySubmission = new Map<string, number>();
  for (const flag of mergedFlags) {
    similarityBySubmission.set(
      flag.submission_a_id,
      Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_a_id) || 0),
    );
    aiBySubmission.set(
      flag.submission_a_id,
      Math.max(flag.ai_suspicion_score, aiBySubmission.get(flag.submission_a_id) || 0),
    );
    if (flag.submission_b_id && flag.submission_b_id !== flag.submission_a_id) {
      similarityBySubmission.set(
        flag.submission_b_id,
        Math.max(flag.similarity_score, similarityBySubmission.get(flag.submission_b_id) || 0),
      );
    }
  }

  const syntheticFlags: IntegrityFlag[] = [];
  const profileUpserts: Array<Record<string, unknown>> = [];
  const snapshots = new Map<string, SubmissionSnapshot>();

  const ensureSnapshot = (submission: SubmissionRow) => {
    const existing = snapshots.get(submission.id);
    if (existing) return existing;

    const next: SubmissionSnapshot = {
      totalScore: 0,
      aiWritingScore: 0,
      similarityScore: 0,
      overlapBreakdown: {
        totalOverlap: 0,
        citedOverlap: 0,
        uncitedOverlap: 0,
        internalPeerOverlap: 0,
        externalSourceOverlap: 0,
      },
      baselineDeviationScore: 0,
      analysisLimited: false,
      limitations: [],
      riskLevel: "low",
      evidence: {
        aiWriting: [],
        similarity: [],
        baselineDeviation: [],
        uncitedMatches: [],
        citedMatches: [],
        peerMatches: [],
        externalMatches: [],
      },
      flags: [],
    };
    snapshots.set(submission.id, next);
    return next;
  };

  for (const submission of submissions) {
    const content = contentMap.get(submission.id) || {
      plainText: "",
      fileType: "unsupported",
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: DOCUMENT_EXTRACTION_ERROR_MESSAGE,
      extractionQuality: null,
      fullText: null,
    };
    const processed = processedContentMap.get(submission.id) || {
      originalText: content.plainText,
      mainBody: content.plainText,
      referenceSection: "",
      hasReferenceSection: false,
      quotedChars: 0,
      citationPatternCount: 0,
      quoteShare: 0,
      extractionQuality: content.extractionQuality || undefined,
    };
    const metrics: WritingProfileMetrics = computeWritingProfileMetrics(content.plainText);
    const baseline = submission.student_id ? profileMap.get(submission.student_id) : null;
    const currentGrade = gradeMap.get(submission.id) ?? null;
    const previousAverage =
      submission.student_id && submissionIdsByStudent.has(submission.student_id)
        ? (() => {
            const previousScores = (submissionIdsByStudent.get(submission.student_id) || [])
              .filter((id) => id !== submission.id)
              .map((id) => gradeMap.get(id))
              .filter((score): score is number => typeof score === "number");
            return previousScores.length > 0
              ? previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length
              : null;
          })()
        : null;

    const baselineDeviation = computeBaselineDeviation(baseline, metrics, {
      previousAverage,
      currentGrade,
    });
    const similarityScore = similarityBySubmission.get(submission.id) || 0;
    const aiScore = aiBySubmission.get(submission.id) || 0;
    const totalRiskScore = computeRisk(similarityScore, aiScore, baselineDeviation.score);
    const snapshot = ensureSnapshot(submission);
    snapshot.totalScore = Math.max(snapshot.totalScore, totalRiskScore);
    snapshot.aiWritingScore = Math.max(snapshot.aiWritingScore, aiScore);
    snapshot.similarityScore = Math.max(snapshot.similarityScore, similarityScore);
    snapshot.baselineDeviationScore = Math.max(snapshot.baselineDeviationScore, baselineDeviation.score);
    snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
      ? "high"
      : severityFromRisk(snapshot.totalScore) === "medium"
        ? "medium"
        : "low";

    if (baselineDeviation.reasons.length > 0) {
      snapshot.evidence.baselineDeviation.push({
        label: "Writing profile deviation",
        value: baselineDeviation.reasons.join(" "),
        score: baselineDeviation.score,
      });
      snapshot.flags.push("baseline deviation");
    }

    if (processed.hasReferenceSection) {
      snapshot.flags.push("reference section excluded from overlap scoring");
    }

    if (processed.extractionQuality && !processed.extractionQuality.isUsable) {
      snapshot.analysisLimited = true;
      snapshot.limitations = Array.from(
        new Set([...snapshot.limitations, ...processed.extractionQuality.reasons]),
      );
      snapshot.evidence.similarity.push({
        label: "Low-quality PDF extraction",
        value: processed.extractionQuality.reasons.join(" "),
        score: 0,
      });
      snapshot.flags.push("low-quality text extraction");
    }

    if (processed.quoteShare >= 0.2) {
      snapshot.evidence.citedMatches.push({
        label: "Heavy reliance on sources",
        value: `${Math.round(processed.quoteShare * 100)}% of the scored main body appears inside quoted blocks or close to citations. Low plagiarism risk, but lecturer review may still be useful.`,
        score: Math.round(processed.quoteShare * 100),
      });
      snapshot.flags.push("heavy reliance on sources");
    }

    if (submission.student_id && metrics.word_count >= 80 && totalRiskScore < 45) {
      const merged = mergeWritingProfile(baseline, metrics);
      profileUpserts.push({
        student_id: submission.student_id,
        average_sentence_complexity: merged.average_sentence_complexity,
        lexile_level: merged.lexile_level,
        error_fingerprint: merged.error_fingerprint,
        vocabulary_breadth: merged.vocabulary_breadth,
        sample_count: merged.sample_count,
        baseline_vector: {
          word_count: merged.word_count,
          sentence_count: merged.sentence_count,
          average_words_per_sentence: merged.average_words_per_sentence,
        },
      });
    }

    if (baselineDeviation.score >= 45) {
      syntheticFlags.push({
        student_a: submission.student_name || submission.student_email || "Student",
        student_b: "Writing baseline",
        submission_a_id: submission.id,
        submission_b_id: submission.id,
        similarity_score: similarityScore,
        ai_suspicion_score: aiScore,
        baseline_deviation_score: baselineDeviation.score,
        total_risk_score: totalRiskScore,
        reason: baselineDeviation.reasons[0] || "The submission deviates materially from the student's stored writing profile.",
        evidence_summary: baselineDeviation.reasons.join(" "),
        matched_excerpt: content.plainText.substring(0, 240),
        recommended_action: actionFromRisk(totalRiskScore),
        integrity_type: baselineDeviation.score > 0 && (similarityScore > 0 || aiScore > 0) ? "mixed" : "baseline-deviation",
        severity: severityFromRisk(totalRiskScore),
      });
    }
  }

  for (const flag of mergedFlags) {
    const submission = submissions.find((item) => item.id === flag.submission_a_id);
    if (!submission) continue;
    const snapshot = ensureSnapshot(submission);
    snapshot.totalScore = Math.max(snapshot.totalScore, flag.total_risk_score);
    snapshot.aiWritingScore = Math.max(snapshot.aiWritingScore, flag.ai_suspicion_score);
    snapshot.similarityScore = Math.max(snapshot.similarityScore, flag.similarity_score);
    snapshot.baselineDeviationScore = Math.max(snapshot.baselineDeviationScore, flag.baseline_deviation_score);
    snapshot.overlapBreakdown.totalOverlap = Math.max(
      snapshot.overlapBreakdown.totalOverlap,
      flag.overlap_analysis?.total_overlap || flag.similarity_score,
    );
    snapshot.overlapBreakdown.citedOverlap = Math.max(
      snapshot.overlapBreakdown.citedOverlap,
      flag.overlap_analysis?.cited_overlap || 0,
    );
    snapshot.overlapBreakdown.uncitedOverlap = Math.max(
      snapshot.overlapBreakdown.uncitedOverlap,
      flag.overlap_analysis?.uncited_overlap || 0,
    );
    snapshot.overlapBreakdown.internalPeerOverlap = Math.max(
      snapshot.overlapBreakdown.internalPeerOverlap,
      flag.overlap_analysis?.internal_peer_overlap || 0,
    );
    snapshot.overlapBreakdown.externalSourceOverlap = Math.max(
      snapshot.overlapBreakdown.externalSourceOverlap,
      flag.overlap_analysis?.external_source_overlap || 0,
    );
    snapshot.riskLevel = severityFromRisk(snapshot.totalScore) === "high"
      ? "high"
      : severityFromRisk(snapshot.totalScore) === "medium"
        ? "medium"
        : "low";

    if (flag.ai_suspicion_score > 0) {
      snapshot.evidence.aiWriting.push({
        label: "AI-writing risk",
        value: flag.evidence_summary || flag.reason,
        score: flag.ai_suspicion_score,
      });
      snapshot.flags.push("ai writing suspicion");
    }

    if (flag.similarity_score > 0) {
      snapshot.evidence.similarity.push({
        label: (flag.overlap_analysis?.uncited_overlap || 0) > 0
          ? "Uncited overlap"
          : (flag.overlap_analysis?.cited_overlap || 0) > 0
            ? "Cited material"
            : "Similarity overlap",
        value: flag.reason,
        score: flag.similarity_score,
      });
      snapshot.flags.push(
        (flag.overlap_analysis?.uncited_overlap || 0) > 0
          ? "uncited overlap"
          : (flag.overlap_analysis?.cited_overlap || 0) > 0
            ? "cited material"
            : "similarity overlap",
      );
    }

    for (const evidence of flag.evidence_groups?.uncited_matches || []) {
      snapshot.evidence.uncitedMatches.push(evidence);
    }
    for (const evidence of flag.evidence_groups?.cited_matches || []) {
      snapshot.evidence.citedMatches.push(evidence);
    }
    for (const evidence of flag.evidence_groups?.peer_matches || []) {
      snapshot.evidence.peerMatches.push(evidence);
    }
    for (const evidence of flag.evidence_groups?.external_matches || []) {
      snapshot.evidence.externalMatches.push(evidence);
    }
  }

  const allFlags = [...mergedFlags, ...syntheticFlags].filter((flag, index, array) => {
    return (
      array.findIndex(
        (item) =>
          item.submission_a_id === flag.submission_a_id &&
          item.submission_b_id === flag.submission_b_id &&
          item.reason === flag.reason,
      ) === index
    );
  });

  const { data: existingReviews, error: reviewsError } = await supabaseAdmin
    .from("academic_integrity_reviews")
    .select("submission_id, decision, lecturer_note, updated_at")
    .in("submission_id", submissions.map((submission) => submission.id))
    .eq("lecturer_id", user.id);

  if (reviewsError) {
    if (isRecoverablePersistenceError(reviewsError)) {
      logWarn("academic_integrity_reviews unavailable, continuing without persisted reviews", {
        function: "check-plagiarism",
      });
    } else {
      logError("academic_integrity_reviews query failed", reviewsError, {
        function: "check-plagiarism",
        assignmentId: requestedAssignmentId,
      });
      warnings.push("Existing integrity review history could not be loaded, but analysis completed.");
    }
  }

  const existingReviewMap = new Map(
    ((existingReviews || []) as Array<Record<string, unknown>>).map((review) => [String(review.submission_id), review]),
  );

  if (requestedAssignmentId && internalFindings.length > 0) {
    await upsertIntegrityFindings({
      supabaseAdmin,
      assignmentId: requestedAssignmentId,
      findings: internalFindings,
      providerLabel: "internal_text_similarity",
      startLogMessage: "internal_similarity_upsert_started",
      successLogMessage: "internal_similarity_upsert_completed",
      errorLogMessage: "internal_similarity_upsert_failed",
      warningMessage: "Internal similarity evidence could not be stored, but analysis completed.",
      warnings,
      requireComparedSubmissionId: true,
    });
  }

  if (requestedAssignmentId && mossFindings.length > 0) {
    await upsertIntegrityFindings({
      supabaseAdmin,
      assignmentId: requestedAssignmentId,
      findings: mossFindings,
      providerLabel: "moss",
      startLogMessage: "moss_similarity_upsert_started",
      successLogMessage: "moss_similarity_upsert_completed",
      errorLogMessage: "moss_similarity_upsert_failed",
      warningMessage: "MOSS similarity evidence could not be stored, but analysis completed.",
      warnings,
      requireComparedSubmissionId: true,
    });
  }

  const reviewUpserts = submissions
    .map((submission) => {
      const snapshot = snapshots.get(submission.id) || null;
      const existingReview = existingReviewMap.get(submission.id);
      if (!snapshot && !existingReview) return null;
      if (snapshot && !crossesIntegrityThreshold(snapshot) && !existingReview) return null;

      const notePayload = (() => {
        if (existingReview?.lecturer_note && typeof existingReview.lecturer_note === "string") {
          try {
            const parsed = ExistingReviewNoteSchema.safeParse(JSON.parse(existingReview.lecturer_note));
            return {
              latestNote: parsed.success ? parsed.data.latestNote : "",
              history: parsed.success ? parsed.data.history : [],
            };
          } catch {
            return { latestNote: "", history: [] };
          }
        }
        return { latestNote: "", history: [] };
      })();

      return {
        submission_id: submission.id,
        lecturer_id: user.id,
        review_type:
          snapshot && snapshot.baselineDeviationScore > 0 && snapshot.aiWritingScore === 0 && snapshot.similarityScore === 0
            ? "baseline-deviation"
            : snapshot && snapshot.aiWritingScore > 0 && snapshot.similarityScore > 0
              ? "mixed"
              : snapshot && snapshot.aiWritingScore > 0
                ? "ai-writing-suspicion"
                : "similarity-plagiarism-suspicion",
        decision: String(existingReview?.decision || "pending"),
        evidence_summary: snapshot
          ? [
              ...snapshot.evidence.aiWriting.map((entry) => `${entry.label}: ${entry.value}`),
              ...snapshot.evidence.similarity.map((entry) => `${entry.label}: ${entry.value}`),
              ...snapshot.evidence.uncitedMatches.map((entry) => `${entry.label}: ${entry.value}`),
              ...snapshot.evidence.citedMatches.map((entry) => `${entry.label}: ${entry.value}`),
              ...snapshot.evidence.peerMatches.map((entry) => `${entry.label}: ${entry.value}`),
              ...snapshot.evidence.externalMatches.map((entry) => `${entry.label}: ${entry.value}`),
              ...snapshot.evidence.baselineDeviation.map((entry) => `${entry.label}: ${entry.value}`),
            ]
              .slice(0, 8)
              .join("\n\n") || null
          : null,
        lecturer_note: JSON.stringify({
          latestNote: notePayload.latestNote,
          history: notePayload.history,
          integritySnapshot: snapshot,
        }),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (reviewUpserts.length > 0) {
    const { error: persistError } = await supabaseAdmin
      .from("academic_integrity_reviews")
      .upsert(reviewUpserts, { onConflict: "submission_id,lecturer_id" });
    if (persistError) {
      if (isRecoverablePersistenceError(persistError)) {
        logWarn("Failed to persist academic integrity reviews, returning analysis without persistence", {
          function: "check-plagiarism",
        });
      } else {
        logError("academic_integrity_reviews upsert failed", persistError, {
          function: "check-plagiarism",
          assignmentId: requestedAssignmentId,
          reviewCount: reviewUpserts.length,
        });
      }
      warnings.push("Integrity review records could not be stored, but analysis completed.");
    }
  }

  if (profileUpserts.length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from("student_writing_profiles")
      .upsert(profileUpserts, { onConflict: "student_id" });
    if (profileError) {
      logError("student_writing_profiles upsert failed", profileError, {
        function: "check-plagiarism",
        assignmentId: requestedAssignmentId,
        profileCount: profileUpserts.length,
      });
      warnings.push("Writing profile history could not be updated, but analysis completed.");
    }
  }

  const thresholdCrossingFlags = allFlags.filter(
    (flag) =>
      flag.similarity_score >= MIN_INTEGRITY_FLAG_SCORE ||
      flag.ai_suspicion_score >= MIN_INTEGRITY_FLAG_SCORE ||
      flag.baseline_deviation_score >= MIN_INTEGRITY_FLAG_SCORE ||
      flag.total_risk_score >= MIN_INTEGRITY_FLAG_SCORE,
  );

  const finalSummary =
    thresholdCrossingFlags.length > 0
      ? `${summary} ${thresholdCrossingFlags.length} submission(s) crossed one or more integrity risk thresholds.`
      : `${summary} No submissions crossed the current integrity thresholds.`;

  logInfo("check-plagiarism completed", {
    assignmentId: requestedAssignmentId,
    submissionCount: submissions.length,
    flags: thresholdCrossingFlags.length,
    warnings: warnings.length,
    durationMs: Date.now() - startedAt,
  });
  if (warnings.length > 0) {
    const analysisLimitedSubmissionCount = Array.from(snapshots.values()).filter(
      (snapshot) => snapshot.analysisLimited,
    ).length;
    logWarn("check-plagiarism completed_with_limitations", {
      assignmentId: requestedAssignmentId,
      submissionCount: submissions.length,
      flags: thresholdCrossingFlags.length,
      warningCount: warnings.length,
      analysisLimitedSubmissionCount,
      warningCategories: sharedCategorizeIntegrityWarnings(warnings),
    });
  }

  return new Response(JSON.stringify({ flags: allFlags, summary: finalSummary, warnings }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
