import type { AtRiskStudent, StudentRiskEvaluation, StudentTrajectory } from "@/lib/studentRisk";
import type { RiskModelPrediction } from "@/lib/riskModelTypes";
import { buildRiskRecommendation, formatReviewReason } from "@/lib/riskModelReasons";

export function mapRiskModelPredictionToAtRiskStudent(
  trajectory: StudentTrajectory,
  prediction: RiskModelPrediction | null,
): AtRiskStudent | null {
  if (!prediction || prediction.riskScore < 25) return null;

  const average = prediction.featureVector.average ?? 0;
  const last = prediction.featureVector.last ?? 0;
  const slope = prediction.featureVector.slope ?? 0;

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    riskScore: prediction.riskScore,
    riskLevel: prediction.riskScore >= 70 ? "critical" : prediction.riskScore >= 45 ? "high" : "moderate",
    avgGrade: Math.round(average),
    lastGrade: Math.round(last),
    trend: slope < -1 ? "declining" : average < 50 ? "stable-low" : "volatile",
    reasonCodes: prediction.reviewReasons,
    flags: prediction.reviewReasons.map(formatReviewReason),
    sparkline: trajectory.scores.slice(-6).map((entry) => entry.score),
    recommendation: buildRiskRecommendation(prediction),
    predictedNext: Math.round(prediction.featureVector.predictedNext ?? 0),
  };
}

export function mapRiskModelPredictionToStudentRiskEvaluation(
  trajectory: StudentTrajectory,
  prediction: RiskModelPrediction | null,
): StudentRiskEvaluation | null {
  if (!prediction) return null;

  const average = prediction.featureVector.average ?? 0;
  const last = prediction.featureVector.last ?? 0;
  const slope = prediction.featureVector.slope ?? 0;
  const reasonCodes = prediction.reviewReasons.length > 0 ? prediction.reviewReasons : ["baseline_monitoring"];
  const flags = prediction.reviewReasons.map(formatReviewReason);

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    rawRiskScore: prediction.riskScore,
    riskBand: prediction.riskBand,
    avgGrade: Math.round(average),
    lastGrade: Math.round(last),
    trend: slope < -1 ? "declining" : average < 50 ? "stable-low" : "volatile",
    flags,
    reasonCodes,
    sparkline: trajectory.scores.slice(-6).map((entry) => entry.score),
    recommendation: buildRiskRecommendation(prediction),
    predictedNext: Math.round(prediction.featureVector.predictedNext ?? 0),
    explanation: [
      `Model risk ${prediction.riskScore.toFixed(2)}%`,
      `confidence ${prediction.confidenceScore.toFixed(4)}`,
      `reason codes: ${reasonCodes.join(", ")}`,
    ].join(". "),
  };
}
