interface RiskSubmission {
  id: string;
}

interface RiskGrade {
  final_score: number | null;
  ai_score: number | null;
}

export function calculateRiskScore({
  submissions,
  grades,
  totalAssignments,
}: {
  submissions: RiskSubmission[];
  grades: RiskGrade[];
  totalAssignments: number;
}) {
  const submissionRate = submissions.length / totalAssignments;
  const submissionRisk = submissionRate >= 0.9 ? 10 : submissionRate >= 0.7 ? 40 : 80;

  const scores = grades
    .map((grade) => grade.final_score ?? grade.ai_score)
    .filter((score): score is number => score != null);

  const avg = scores.length
    ? scores.reduce((total, score) => total + score, 0) / scores.length
    : 0;

  const avgRisk = avg >= 70 ? 20 : avg >= 50 ? 50 : 80;

  let trendRisk = 50;
  if (scores.length >= 4) {
    const mid = Math.floor(scores.length / 2);
    const first = scores.slice(0, mid);
    const last = scores.slice(mid);

    const firstAvg = first.reduce((total, score) => total + score, 0) / first.length;
    const lastAvg = last.reduce((total, score) => total + score, 0) / last.length;

    if (lastAvg > firstAvg) trendRisk = 20;
    else if (lastAvg < firstAvg) trendRisk = 80;
  }

  const completionRisk = submissionRisk;

  const riskScore =
    submissionRisk * 0.3 +
    trendRisk * 0.25 +
    avgRisk * 0.25 +
    completionRisk * 0.2;

  return Math.round(riskScore);
}

export function getRiskLabel(score: number) {
  if (score <= 30) return { label: "Low", color: "green" };
  if (score <= 60) return { label: "Medium", color: "orange" };
  return { label: "High", color: "red" };
}
