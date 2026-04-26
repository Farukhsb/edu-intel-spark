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

export interface AtRiskStudent {
  name: string;
  email: string | null;
  studentId: string;
  riskScore: number;
  riskLevel: "critical" | "high" | "moderate";
  avgGrade: number;
  lastGrade: number;
  trend: "declining" | "stable-low" | "volatile";
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

export function computeRisk(trajectory: StudentTrajectory): AtRiskStudent | null {
  const scores = trajectory.scores.map((entry) => entry.score);
  if (scores.length === 0) return null;

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const last = scores[scores.length - 1];
  const { slope, intercept } = linearRegression(scores);
  const predictedNext = Math.max(0, Math.min(100, slope * scores.length + intercept));

  let riskScore = 0;
  const flags: string[] = [];

  if (average < 40) {
    riskScore += 30;
    flags.push("Average below 40%");
  } else if (average < 50) {
    riskScore += 20;
    flags.push("Average below 50%");
  }

  if (slope < -3) {
    riskScore += 25;
    flags.push("Steep grade decline");
  } else if (slope < -1) {
    riskScore += 15;
    flags.push("Gradual grade decline");
  }

  if (scores.length >= 2 && last < average - 15) {
    riskScore += 15;
    flags.push("Sudden drop in last grade");
  }

  if (predictedNext < 40) {
    riskScore += 15;
    flags.push(`Expected next outcome: ${Math.round(predictedNext)}%`);
  }

  if (scores.length >= 3) {
    const variance =
      scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    if (standardDeviation > 15) {
      riskScore += 10;
      flags.push("Highly inconsistent grades");
    }
  }

  if (scores.length === 1 && last < 50) {
    riskScore += 10;
    flags.push("Only 1 submission graded");
  }

  riskScore = Math.min(100, riskScore);
  if (riskScore < 25) return null;

  const trend: AtRiskStudent["trend"] =
    slope < -1 ? "declining" : average < 50 ? "stable-low" : "volatile";
  const riskLevel: AtRiskStudent["riskLevel"] =
    riskScore >= 70 ? "critical" : riskScore >= 45 ? "high" : "moderate";

  const recommendations: string[] = [];
  if (slope < -3) recommendations.push("Urgent: schedule a 1-on-1 meeting to discuss grade trajectory.");
  if (average < 40) recommendations.push("Refer to student support services and consider tutoring.");
  if (last < average - 15) recommendations.push("Recent performance dipped sharply. Check for academic or personal barriers.");
  if (predictedNext < 40) recommendations.push("The current assessment pattern suggests this student may need support before the next deadline.");
  if (scores.length === 1) recommendations.push("Data is limited. Monitor closely after the next submission.");
  if (recommendations.length === 0) {
    recommendations.push("Schedule a check-in to review study strategies and agree short-term goals.");
  }

  return {
    name: trajectory.name,
    email: trajectory.email,
    studentId: trajectory.studentId,
    riskScore,
    riskLevel,
    avgGrade: Math.round(average),
    lastGrade: Math.round(last),
    trend,
    flags,
    sparkline: scores.slice(-6),
    recommendation: recommendations.join(" "),
    predictedNext: Math.round(predictedNext),
  };
}
