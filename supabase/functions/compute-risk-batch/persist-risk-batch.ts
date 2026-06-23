import { HttpError } from "../_shared/auth.ts";

import type { RiskBatchLoadResult, ScoredTrajectory } from "./load-risk-batch-data.ts";
import { prepareRiskBatchStudent } from "./prepare-student-risk.ts";

type PersistRiskBatchInput = {
  supabaseAdmin: any;
  institutionId: string;
  snapshotDate: string;
  featureVersion: string;
  loaded: RiskBatchLoadResult;
};

export type PersistRiskBatchResult = {
  snapshotCount: number;
  predictionCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
};

async function persistPreparedStudentRisk(
  supabaseAdmin: any,
  institutionId: string,
  snapshotDate: string,
  featureVersion: string,
  batchGeneratedAt: string,
  totalAssignments: number,
  assignmentById: RiskBatchLoadResult["assignmentById"],
  submissionsByStudentId: RiskBatchLoadResult["submissionsByStudentId"],
  engagementEventsByEmail: RiskBatchLoadResult["engagementEventsByEmail"],
  trajectory: ScoredTrajectory,
) {
  const prepared = prepareRiskBatchStudent(trajectory, {
    snapshotDate,
    featureVersion,
    batchGeneratedAt,
    assignmentById,
    submissionsByStudentId,
    engagementEventsByEmail,
    totalAssignments,
  });

  if (!prepared) {
    return null;
  }

  const {
    evaluation,
    modelPrediction,
    composite,
    snapshotFeatures,
    riskBand,
    academicRiskScore,
    submissionSummary,
    engagementSummary,
    modelVersion: resolvedModelVersion,
  } = prepared;
  const riskScore = Number(((composite?.rawRiskScore ?? academicRiskScore) / 100).toFixed(4));

  const { data: snapshotRow, error: snapshotError } = await supabaseAdmin
    .from("student_risk_snapshots")
    .upsert(
      {
        student_id: trajectory.studentId,
        institution_id: institutionId,
        snapshot_date: snapshotDate,
        feature_version: featureVersion,
        features: snapshotFeatures,
      },
      {
        onConflict: "student_id,snapshot_date,feature_version",
      },
    )
    .select("id, student_id, institution_id, snapshot_date, feature_version")
    .single();

  if (snapshotError || !snapshotRow) {
    throw new HttpError(500, snapshotError?.message || "Failed to persist risk snapshot");
  }

  const { error: predictionError } = await supabaseAdmin
    .from("student_risk_predictions")
    .upsert(
      {
        snapshot_id: snapshotRow.id,
        student_id: trajectory.studentId,
        institution_id: institutionId,
        prediction_date: snapshotDate,
        generated_at: batchGeneratedAt,
        feature_version: featureVersion,
        model_version: resolvedModelVersion,
        risk_score: riskScore,
        risk_band: riskBand,
        reason_codes: composite?.reasonCodes ?? evaluation.reasonCodes ?? ["baseline_monitoring"],
        confidence_score: modelPrediction?.confidenceScore ?? null,
        explanation:
          composite?.explanation ?? evaluation.explanation ?? "Risk score computed from engagement and submission patterns.",
        calibration_metrics: modelPrediction?.calibrationMetrics ?? {},
        details: {
          ...snapshotFeatures,
          input_snapshot_reference: snapshotRow.id,
          risk_band: riskBand,
          risk_score: riskScore,
          raw_risk_score: composite?.rawRiskScore ?? academicRiskScore,
          academic_risk_score: academicRiskScore,
          engagement_event_count: engagementSummary.eventCount,
          engagement_last_event_at: engagementSummary.lastEventAt,
          submitted_assignments: submissionSummary.submittedAssignments,
          late_submissions: submissionSummary.lateSubmissions,
          total_assignments: totalAssignments,
          model_needs_review: modelPrediction?.needsReview ?? null,
          model_review_reasons: modelPrediction?.reviewReasons ?? null,
          model_confidence_score: modelPrediction?.confidenceScore ?? null,
          model_calibration_metrics: modelPrediction?.calibrationMetrics ?? null,
          composite_reason_codes: composite?.reasonCodes ?? null,
          composite_component_scores: composite?.componentScores ?? null,
          advisory_only: true,
        },
      },
      {
        onConflict: "snapshot_id,model_version",
      },
    );

  if (predictionError) {
    throw new HttpError(500, predictionError.message);
  }

  return riskBand;
}

export async function persistRiskBatchStudents({
  supabaseAdmin,
  institutionId,
  snapshotDate,
  featureVersion,
  loaded,
}: PersistRiskBatchInput): Promise<PersistRiskBatchResult> {
  let snapshotCount = 0;
  let predictionCount = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;

  for (const trajectory of loaded.scoredTrajectories) {
    const riskBand = await persistPreparedStudentRisk(
      supabaseAdmin,
      institutionId,
      snapshotDate,
      featureVersion,
      loaded.batchGeneratedAt,
      loaded.totalAssignments,
      loaded.assignmentById,
      loaded.submissionsByStudentId,
      loaded.engagementEventsByEmail,
      trajectory,
    );

    if (!riskBand) {
      continue;
    }

    snapshotCount += 1;
    predictionCount += 1;
    if (riskBand === "high") {
      highRiskCount += 1;
    } else if (riskBand === "medium") {
      mediumRiskCount += 1;
    } else {
      lowRiskCount += 1;
    }
  }

  return {
    snapshotCount,
    predictionCount,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
  };
}
