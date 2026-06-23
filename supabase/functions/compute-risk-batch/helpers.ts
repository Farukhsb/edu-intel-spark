import { z } from "https://esm.sh/zod@3.23.8";

import type { StudentRiskCompositeEvaluation } from "../../../src/lib/studentRiskComposite.ts";
import type { StudentTrajectory } from "../../../src/lib/studentRisk.ts";
import type { StudentRiskEvaluation } from "../../../src/lib/studentRisk.ts";

export type BatchRequest = {
  featureVersion?: string;
  snapshotDate?: string;
};

export type BatchResponse = {
  snapshotDate: string;
  featureVersion: string;
  modelVersion: string;
  institutionId: string;
  studentCount: number;
  snapshotCount: number;
  predictionCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
};

export type EngagementEventRow = {
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

export type StudentSubmissionSummary = {
  studentId: string;
  submittedAssignments: number;
  lateSubmissions: number;
};

export const BatchRequestSchema = z.object({
  featureVersion: z.string().trim().min(1).optional(),
  snapshotDate: z.string().trim().min(1).optional(),
});

export const DEFAULT_FEATURE_VERSION = "v1";

export function getNumericGrade(scoreRow: { final_score: number | null; ai_score: number | null }) {
  const score = scoreRow.final_score ?? scoreRow.ai_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function getEngagementEmail(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const keys = ["email", "user_email", "student_email"];
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  return null;
}

export function buildStudentSubmissionSummary(
  studentId: string,
  submissionRows: Array<{
    assignment_id: string;
    submitted_at: string | null;
    status: string;
  }>,
  assignmentById: Map<string, { dueDate: string | null }>,
) {
  const submittedAssignments = new Set<string>();
  let lateSubmissions = 0;

  for (const submission of submissionRows) {
    submittedAssignments.add(submission.assignment_id);
    const dueDate = assignmentById.get(submission.assignment_id)?.dueDate ?? null;
    if (dueDate && submission.submitted_at) {
      const submittedAt = new Date(submission.submitted_at).getTime();
      const dueAt = new Date(dueDate).getTime();
      if (Number.isFinite(submittedAt) && Number.isFinite(dueAt) && submittedAt > dueAt) {
        lateSubmissions += 1;
      }
    } else if (submission.status === "late") {
      lateSubmissions += 1;
    }
  }

  return {
    studentId,
    submittedAssignments: submittedAssignments.size,
    lateSubmissions,
  } satisfies StudentSubmissionSummary;
}

export function buildEngagementSummary(
  email: string | null,
  eventsByEmail: Map<string, EngagementEventRow[]>,
  snapshotDate: string,
) {
  if (!email) {
    return {
      eventCount: 0,
      lastEventAt: null,
    };
  }

  const normalizedEmail = email.toLowerCase();
  const events = eventsByEmail.get(normalizedEmail) ?? [];
  const lastEventAt = events[0]?.occurred_at ?? null;

  return {
    eventCount: events.length,
    lastEventAt: lastEventAt ?? snapshotDate,
  };
}

export function buildFallbackAcademicEvaluation(
  trajectory: StudentTrajectory,
  riskBand: StudentRiskEvaluation["riskBand"],
) {
  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    rawRiskScore: 0,
    riskBand,
    avgGrade: 0,
    lastGrade: 0,
    trend: "stable-low" as const,
    flags: [],
    reasonCodes: ["baseline_monitoring"],
    sparkline: [],
    recommendation: "Monitor engagement and submission activity.",
    predictedNext: 0,
    explanation: "No graded academic history was available.",
  } satisfies StudentRiskEvaluation;
}

export function buildRiskDetails(
  evaluation: StudentRiskEvaluation,
  options: {
    composite: StudentRiskCompositeEvaluation | null;
    snapshotDate: string;
    featureVersion: string;
    generatedAt: string;
    submissionCount: number;
    scoreCount: number;
    firstSubmissionAt: string | null;
    lastSubmissionAt: string | null;
    modelVersion: string;
    modelSource: "ml" | "heuristic";
    modelConfidence: number | null;
    modelConfidenceScore: number | null;
    modelRiskScore: number;
    modelRiskBand: string;
    modelNeedsReview: boolean | null;
    modelReviewReasons: string[] | null;
    modelProbabilityByBand: Record<string, number> | null;
    modelFeatureVector: Record<string, number> | null;
    modelCalibrationMetrics: Record<string, number | null> | null;
    inputSnapshotReference?: string | null;
    engagementEventCount: number;
    engagementLastEventAt: string | null;
    totalAssignments: number;
    submittedAssignments: number;
    lateSubmissions: number;
  },
) {
  const composite = options.composite;
  return {
    snapshot_date: options.snapshotDate,
    feature_version: options.featureVersion,
    generated_at: options.generatedAt,
    ...(options.inputSnapshotReference ? { input_snapshot_reference: options.inputSnapshotReference } : {}),
    submission_count: options.submissionCount,
    score_count: options.scoreCount,
    first_submission_at: options.firstSubmissionAt,
    last_submission_at: options.lastSubmissionAt,
    risk_score: composite?.rawRiskScore ?? evaluation.rawRiskScore,
    risk_band: composite?.riskBand ?? evaluation.riskBand,
    reason_codes: composite?.reasonCodes ?? evaluation.reasonCodes,
    flags: composite?.flags ?? evaluation.flags,
    avg_grade: evaluation.avgGrade,
    last_grade: evaluation.lastGrade,
    predicted_next: evaluation.predictedNext,
    trend: evaluation.trend,
    recommendation: composite
      ? `${evaluation.recommendation} Composite risk blends academic, engagement, and submission patterns.`
      : evaluation.recommendation,
    explanation: composite?.explanation ?? evaluation.explanation,
    sparkline: evaluation.sparkline,
    academic_risk_score: evaluation.rawRiskScore,
    engagement_event_count: options.engagementEventCount,
    engagement_last_event_at: options.engagementLastEventAt,
    non_submission_total_assignments: options.totalAssignments,
    non_submission_submitted_assignments: options.submittedAssignments,
    non_submission_late_submissions: options.lateSubmissions,
    composite_risk_score: composite?.rawRiskScore ?? evaluation.rawRiskScore,
    composite_risk_band: composite?.riskBand ?? evaluation.riskBand,
    composite_reason_codes: composite?.reasonCodes ?? evaluation.reasonCodes,
    composite_component_scores: composite?.componentScores ?? {
      academic: evaluation.rawRiskScore,
      engagement: null,
      nonSubmission: null,
    },
    model_version: options.modelVersion,
    model_source: options.modelSource,
    model_confidence: options.modelConfidence,
    model_confidence_score: options.modelConfidenceScore,
    model_risk_score: options.modelRiskScore,
    model_risk_band: options.modelRiskBand,
    model_needs_review: options.modelNeedsReview,
    model_review_reasons: options.modelReviewReasons,
    model_probability_by_band: options.modelProbabilityByBand,
    model_feature_vector: options.modelFeatureVector,
    model_calibration_metrics: options.modelCalibrationMetrics,
    advisory_only: true,
  };
}
