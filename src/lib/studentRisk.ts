export interface StudentTrajectoryPoint {
  score: number;
  date: string;
  assignmentTitle: string;
}

export interface StudentTrajectory {
  name: string;
  email: string | null;
  studentId: string;
  scores: StudentTrajectoryPoint[];
}

export interface StudentRiskEvaluation {
  name: string;
  email: string | null;
  studentId: string;
  rawRiskScore: number;
  riskBand: "low" | "medium" | "high";
  avgGrade: number;
  lastGrade: number;
  trend: "declining" | "stable-low" | "volatile";
  flags: string[];
  reasonCodes: string[];
  sparkline: number[];
  recommendation: string;
  predictedNext: number;
  explanation: string;
}

export interface AtRiskStudent {
  name: string;
  email: string | null;
  studentId: string;
  riskScore: number;
  riskLevel: "critical" | "high" | "moderate";
  avgGrade: number;
  lastGrade: number;
  trend: "declining" | "stable-low" | "volatile";
  reasonCodes: string[];
  flags: string[];
  sparkline: number[];
  recommendation: string;
  predictedNext: number;
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function toDateMs(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function buildReasonCodes(params: {
  average: number;
  slope: number;
  last: number;
  predictedNext: number;
  standardDeviation: number | null;
  scoresLength: number;
}): string[] {
  const reasonCodes: string[] = [];

  if (params.average < 40) {
    reasonCodes.push("average_below_40");
  } else if (params.average < 50) {
    reasonCodes.push("average_below_50");
  }

  if (params.slope < -3) {
    reasonCodes.push("steep_grade_decline");
  } else if (params.slope < -1) {
    reasonCodes.push("gradual_grade_decline");
  }

  if (params.scoresLength >= 2 && params.last < params.average - 15) {
    reasonCodes.push("recent_grade_drop");
  }

  if (params.predictedNext < 40) {
    reasonCodes.push("predicted_next_below_40");
  }

  if (params.standardDeviation != null && params.standardDeviation > 15) {
    reasonCodes.push("high_variance");
  }

  if (params.scoresLength === 1 && params.last < 50) {
    reasonCodes.push("limited_history");
  }

  if (reasonCodes.length === 0) {
    reasonCodes.push("baseline_monitoring");
  }

  return reasonCodes;
}

/**
 * @deprecated Use `scoreStudentRisk` from `riskModel.ts` instead.
 */
export function evaluateStudentRisk(
  trajectory: StudentTrajectory,
  options?: {
    referenceDate?: string;
    staleWindowDays?: number;
  },
): StudentRiskEvaluation | null {
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[studentRisk] This function is deprecated. Use scoreStudentRisk from riskModel.ts instead.",
    );
  }

  const scores = trajectory.scores.map((entry) => entry.score);
  if (scores.length === 0) return null;
  const referenceDateMs = toDateMs(options?.referenceDate ?? new Date().toISOString());
  const staleWindowDays = options?.staleWindowDays ?? 30;
  const latestSubmissionDateMs = trajectory.scores
    .map((entry) => toDateMs(entry.date))
    .filter((value): value is number => value != null)
    .reduce((latest, value) => Math.max(latest, value), Number.NEGATIVE_INFINITY);

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const last = scores[scores.length - 1];
  const { slope, intercept } = linearRegression(scores);
  const predictedNext = Math.max(0, Math.min(100, slope * scores.length + intercept));

  let rawRiskScore = 0;
  const flags: string[] = [];

  if (average < 40) {
    rawRiskScore += 30;
    flags.push("Average below 40%");
  } else if (average < 50) {
    rawRiskScore += 20;
    flags.push("Average below 50%");
  }

  if (slope < -3) {
    rawRiskScore += 25;
    flags.push("Steep grade decline");
  } else if (slope < -1) {
    rawRiskScore += 15;
    flags.push("Gradual grade decline");
  }

  if (scores.length >= 2 && last < average - 15) {
    rawRiskScore += 15;
    flags.push("Sudden drop in last grade");
  }

  if (predictedNext < 40) {
    rawRiskScore += 15;
    flags.push(`Expected next outcome: ${Math.round(predictedNext)}%`);
  }

  let standardDeviation: number | null = null;
  if (scores.length >= 3) {
    const variance =
      scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / scores.length;
    standardDeviation = Math.sqrt(variance);
    if (standardDeviation > 15) {
      rawRiskScore += 10;
      flags.push("Highly inconsistent grades");
    }
  }

  if (scores.length === 1 && last < 50) {
    rawRiskScore += 10;
    flags.push("Only 1 submission graded");
  }

  rawRiskScore = Math.min(100, rawRiskScore);

  const trend: StudentRiskEvaluation["trend"] =
    slope < -1 ? "declining" : average < 50 ? "stable-low" : "volatile";
  const reasonCodes = buildReasonCodes({
    average,
    slope,
    last,
    predictedNext,
    standardDeviation,
    scoresLength: scores.length,
  });
  if (
    referenceDateMs != null &&
    Number.isFinite(latestSubmissionDateMs) &&
    referenceDateMs - latestSubmissionDateMs > staleWindowDays * 24 * 60 * 60 * 1000
  ) {
    reasonCodes.push("stale_data");
  }

  const recommendations: string[] = [];
  if (slope < -3) recommendations.push("Urgent: schedule a 1-on-1 meeting to discuss grade trajectory.");
  if (average < 40) recommendations.push("Refer to student support services and consider tutoring.");
  if (last < average - 15) recommendations.push("Recent performance dipped sharply. Check for academic or personal barriers.");
  if (predictedNext < 40) recommendations.push("The current assessment pattern suggests this student may need support before the next deadline.");
  if (scores.length === 1) recommendations.push("Data is limited. Monitor closely after the next submission.");
  if (reasonCodes.includes("stale_data")) {
    recommendations.push("The latest evidence is stale. Review with recent assessment or engagement data before escalating.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Schedule a check-in to review study strategies and agree short-term goals.");
  }

  const explanationParts = [
    `Average ${Math.round(average)}%`,
    `last grade ${Math.round(last)}%`,
    `next outcome ${Math.round(predictedNext)}%`,
  ];

  if (reasonCodes.length > 0 && reasonCodes[0] !== "baseline_monitoring") {
    explanationParts.push(`reason codes: ${reasonCodes.join(", ")}`);
  }

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    rawRiskScore,
    riskBand: rawRiskScore >= 70 ? "high" : rawRiskScore >= 45 ? "medium" : "low",
    avgGrade: Math.round(average),
    lastGrade: Math.round(last),
    trend,
    flags,
    reasonCodes,
    sparkline: scores.slice(-6),
    recommendation: recommendations.join(" "),
    predictedNext: Math.round(predictedNext),
    explanation: explanationParts.join(". "),
  };
}

/**
 * @deprecated Use `scoreStudentRisk` from `riskModel.ts` instead.
 */
export function computeRisk(
  trajectory: StudentTrajectory,
  options?: {
    referenceDate?: string;
    staleWindowDays?: number;
  },
): AtRiskStudent | null {
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[studentRisk] This function is deprecated. Use scoreStudentRisk from riskModel.ts instead.",
    );
  }

  const evaluation = evaluateStudentRisk(trajectory, options);
  if (!evaluation || evaluation.rawRiskScore < 25) return null;

  return {
    name: evaluation.name,
    email: evaluation.email,
    studentId: evaluation.studentId,
    riskScore: evaluation.rawRiskScore,
    riskLevel:
      evaluation.rawRiskScore >= 70 ? "critical" : evaluation.rawRiskScore >= 45 ? "high" : "moderate",
    avgGrade: evaluation.avgGrade,
    lastGrade: evaluation.lastGrade,
    trend: evaluation.trend,
    reasonCodes: evaluation.reasonCodes,
    flags: evaluation.flags,
    sparkline: evaluation.sparkline,
    recommendation: evaluation.recommendation,
    predictedNext: evaluation.predictedNext,
  };
}
