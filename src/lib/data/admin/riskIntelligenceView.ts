import { redactStudentIdentity } from "@/lib/exportPrivacy";

export type RiskBand = "low" | "medium" | "high";

export type RiskPredictionDisplayRow = {
  id: string;
  studentLabel: string;
  predictionDate: string;
  generatedAt: string;
  modelVersion: string;
  featureVersion: string;
  riskScore: number;
  riskBand: RiskBand;
  confidenceScore: number | null;
  reasonCodes: string[];
  explanation: string | null;
  calibrationMetrics: {
    calibrationTemperature: number | null;
    validationNll: number | null;
    validationConfidenceEce: number | null;
    trainAccuracy: number | null;
    testAccuracy: number | null;
  } | null;
  componentScores: {
    academic: number | null;
    engagement: number | null;
    nonSubmission: number | null;
  };
  componentSignals: {
    engagementEventCount: number | null;
    lastEngagementAt: string | null;
    submittedAssignments: number | null;
    lateSubmissions: number | null;
    totalAssignments: number | null;
  };
  feedbackCount: number;
  latestFeedback: string | null;
};

export type RiskIntelligenceDataset = {
  profiles: Array<{ id: string; full_name: string | null; email: string | null }>;
  predictions: Array<{
    id: string;
    student_id: string;
    prediction_date: string;
    generated_at: string;
    model_version: string;
    feature_version: string;
    risk_score: number | string;
    confidence_score: number | null;
    risk_band: string;
    reason_codes: string[] | null;
    explanation: string | null;
    details: unknown | null;
    calibration_metrics: unknown | null;
  }>;
  snapshots: Array<{ snapshot_date: string; feature_version: string }>;
  feedback: Array<{
    prediction_id: string;
    feedback_type: string;
    notes: string | null;
  }>;
};

export function buildRiskIntelligenceDisplayRows(dataset: RiskIntelligenceDataset) {
  const studentLabelById = new Map(dataset.profiles.map((profile) => [profile.id, profile.full_name || profile.email || "Unknown student"]));
  const feedbackByPredictionId = new Map<string, RiskIntelligenceDataset["feedback"]>();

  const parseCalibrationMetrics = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const candidate = value as {
      calibrationTemperature?: unknown;
      validationNll?: unknown;
      validationConfidenceEce?: unknown;
      trainAccuracy?: unknown;
      testAccuracy?: unknown;
    };

    return {
      calibrationTemperature: typeof candidate.calibrationTemperature === "number" ? candidate.calibrationTemperature : null,
      validationNll: typeof candidate.validationNll === "number" ? candidate.validationNll : null,
      validationConfidenceEce: typeof candidate.validationConfidenceEce === "number" ? candidate.validationConfidenceEce : null,
      trainAccuracy: typeof candidate.trainAccuracy === "number" ? candidate.trainAccuracy : null,
      testAccuracy: typeof candidate.testAccuracy === "number" ? candidate.testAccuracy : null,
    };
  };

  const getDetails = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as {
      academic_risk_score?: number | null;
      engagement_event_count?: number | null;
      engagement_last_event_at?: string | null;
      non_submission_submitted_assignments?: number | null;
      non_submission_late_submissions?: number | null;
      non_submission_total_assignments?: number | null;
      composite_component_scores?: {
        academic?: number | null;
        engagement?: number | null;
        nonSubmission?: number | null;
      } | null;
      composite_reason_codes?: string[] | null;
      composite_risk_score?: number | null;
      composite_risk_band?: string | null;
      model_calibration_metrics?: {
        calibrationTemperature?: number | null;
        validationNll?: number | null;
        validationConfidenceEce?: number | null;
        trainAccuracy?: number | null;
        testAccuracy?: number | null;
      } | null;
    };
  };

  dataset.feedback.forEach((entry) => {
    const current = feedbackByPredictionId.get(entry.prediction_id) ?? [];
    current.push(entry);
    feedbackByPredictionId.set(entry.prediction_id, current);
  });

  const displayRows: RiskPredictionDisplayRow[] = dataset.predictions
    .slice()
    .sort((left, right) => Number(right.risk_score) - Number(left.risk_score))
    .map((prediction) => {
      const details = getDetails(prediction.details);
      const relatedFeedback = feedbackByPredictionId.get(prediction.id) ?? [];
      const latestFeedback = relatedFeedback[0];
      const calibrationMetricsSource = parseCalibrationMetrics(prediction.calibration_metrics) || parseCalibrationMetrics(details.model_calibration_metrics) || null;

      return {
        id: prediction.id,
        studentLabel: studentLabelById.get(prediction.student_id) || "Unknown student",
        predictionDate: prediction.prediction_date,
        generatedAt: prediction.generated_at,
        modelVersion: prediction.model_version,
        featureVersion: prediction.feature_version,
        riskScore: Number(prediction.risk_score),
        riskBand: prediction.risk_band as RiskBand,
        confidenceScore: prediction.confidence_score,
        reasonCodes: details.composite_reason_codes || prediction.reason_codes || [],
        explanation: prediction.explanation,
        calibrationMetrics: calibrationMetricsSource
          ? {
            calibrationTemperature: typeof calibrationMetricsSource.calibrationTemperature === "number"
              ? calibrationMetricsSource.calibrationTemperature
              : null,
            validationNll: typeof calibrationMetricsSource.validationNll === "number"
              ? calibrationMetricsSource.validationNll
              : null,
            validationConfidenceEce: typeof calibrationMetricsSource.validationConfidenceEce === "number"
              ? calibrationMetricsSource.validationConfidenceEce
              : null,
            trainAccuracy: typeof calibrationMetricsSource.trainAccuracy === "number"
              ? calibrationMetricsSource.trainAccuracy
              : null,
            testAccuracy: typeof calibrationMetricsSource.testAccuracy === "number"
              ? calibrationMetricsSource.testAccuracy
              : null,
          }
          : null,
        componentScores: {
          academic: details.composite_component_scores?.academic ?? details.academic_risk_score ?? null,
          engagement: details.composite_component_scores?.engagement ?? null,
          nonSubmission: details.composite_component_scores?.nonSubmission ?? null,
        },
        componentSignals: {
          engagementEventCount: details.engagement_event_count ?? null,
          lastEngagementAt: details.engagement_last_event_at ?? null,
          submittedAssignments: details.non_submission_submitted_assignments ?? null,
          lateSubmissions: details.non_submission_late_submissions ?? null,
          totalAssignments: details.non_submission_total_assignments ?? null,
        },
        feedbackCount: relatedFeedback.length,
        latestFeedback: latestFeedback
          ? `${latestFeedback.feedback_type}${latestFeedback.notes ? `: ${latestFeedback.notes}` : ""}`
          : null,
      };
    });

  return {
    displayRows,
    snapshotCount: dataset.snapshots.length,
    feedbackCount: dataset.feedback.length,
    snapshotDate: displayRows[0]?.predictionDate ?? dataset.snapshots[0]?.snapshot_date ?? null,
    latestModelVersion: displayRows[0]?.modelVersion ?? null,
  };
}

export function summarizeRiskPredictions(predictions: RiskPredictionDisplayRow[]) {
  const highRisk = predictions.filter((prediction) => prediction.riskBand === "high").length;
  const mediumRisk = predictions.filter((prediction) => prediction.riskBand === "medium").length;
  const feedbackCovered = predictions.filter((prediction) => prediction.feedbackCount > 0).length;
  const averageRisk =
    predictions.length > 0
      ? Math.round((predictions.reduce((total, prediction) => total + prediction.riskScore, 0) / predictions.length) * 100)
      : 0;

  return {
    highRisk,
    mediumRisk,
    feedbackCovered,
    averageRisk,
  };
}

export function buildRiskIntelligenceCsv(
  predictions: RiskPredictionDisplayRow[],
  options?: { redactStudentIdentity?: boolean },
) {
  const lines = [
    "Student,Risk Band,Risk Score,Confidence,Model Version,Feature Version,Prediction Date,Generated At,Reasons,Explanation,Feedback Count,Latest Feedback",
    ...predictions.map((row, index) => {
      const studentLabel = options?.redactStudentIdentity
        ? redactStudentIdentity(index).studentName
        : row.studentLabel;
      return `"${studentLabel}",${row.riskBand},${row.riskScore.toFixed(3)},${row.confidenceScore ?? ""},${row.modelVersion},${row.featureVersion},"${row.predictionDate}","${row.generatedAt}","${row.reasonCodes.join("; ")}","${row.explanation ?? ""}",${row.feedbackCount},"${row.latestFeedback ?? ""}"`;
    }),
  ];

  return lines.join("\n");
}

export function downloadRiskIntelligenceCsv(
  predictions: RiskPredictionDisplayRow[],
  options?: { redactStudentIdentity?: boolean },
) {
  const csv = buildRiskIntelligenceCsv(predictions, options);

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `risk_intelligence_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
