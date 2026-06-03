export type RiskBand = "low" | "medium" | "high";

export type RiskPredictionDisplayRow = {
  id: string;
  studentLabel: string;
  predictionDate: string;
  modelVersion: string;
  riskScore: number;
  riskBand: RiskBand;
  reasonCodes: string[];
  explanation: string | null;
  feedbackCount: number;
  latestFeedback: string | null;
};

export type RiskIntelligenceDataset = {
  profiles: Array<{ id: string; full_name: string | null; email: string | null }>;
  predictions: Array<{
    id: string;
    student_id: string;
    prediction_date: string;
    model_version: string;
    risk_score: number | string;
    risk_band: string;
    reason_codes: string[] | null;
    explanation: string | null;
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

  dataset.feedback.forEach((entry) => {
    const current = feedbackByPredictionId.get(entry.prediction_id) ?? [];
    current.push(entry);
    feedbackByPredictionId.set(entry.prediction_id, current);
  });

  const displayRows: RiskPredictionDisplayRow[] = dataset.predictions
    .slice()
    .sort((left, right) => Number(right.risk_score) - Number(left.risk_score))
    .map((prediction) => {
      const relatedFeedback = feedbackByPredictionId.get(prediction.id) ?? [];
      const latestFeedback = relatedFeedback[0];

      return {
        id: prediction.id,
        studentLabel: studentLabelById.get(prediction.student_id) || "Unknown student",
        predictionDate: prediction.prediction_date,
        modelVersion: prediction.model_version,
        riskScore: Number(prediction.risk_score),
        riskBand: prediction.risk_band as RiskBand,
        reasonCodes: prediction.reason_codes || [],
        explanation: prediction.explanation,
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
    latestModelVersion: displayRows[0]?.modelVersion ?? dataset.snapshots[0]?.feature_version ?? null,
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

export function downloadRiskIntelligenceCsv(predictions: RiskPredictionDisplayRow[]) {
  const lines = [
    "Student,Risk Band,Risk Score,Model Version,Prediction Date,Reasons,Explanation,Feedback Count,Latest Feedback",
    ...predictions.map((row) =>
      `"${row.studentLabel}",${row.riskBand},${row.riskScore.toFixed(3)},${row.modelVersion},"${row.predictionDate}","${row.reasonCodes.join("; ")}","${row.explanation ?? ""}",${row.feedbackCount},"${row.latestFeedback ?? ""}"`,
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `risk_intelligence_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
