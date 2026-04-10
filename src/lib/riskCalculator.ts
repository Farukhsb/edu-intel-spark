export function calculateRiskScore({
  submissions,
  grades,
  totalAssignments
}: {
  submissions: any[];
  grades: any[];
  totalAssignments: number;
}) {
  // 1. Submission rate
  const submissionRate = submissions.length / totalAssignments;
  let submissionRisk =
    submissionRate >= 0.9 ? 10 :
    submissionRate >= 0.7 ? 40 : 80;

  // 2. Average grade
  const scores = grades
    .map(g => g.final_score ?? g.ai_score)
    .filter(Boolean);

  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  let avgRisk =
    avg >= 70 ? 20 :
    avg >= 50 ? 50 : 80;

  // 3. Grade trend (simple but valid)
  let trendRisk = 50;
  if (scores.length >= 4) {
    const mid = Math.floor(scores.length / 2);
    const first = scores.slice(0, mid);
    const last = scores.slice(mid);

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;

    if (lastAvg > firstAvg) trendRisk = 20;
    else if (lastAvg < firstAvg) trendRisk = 80;
  }

  // 4. Completion rate (same as submission for now — acceptable)
  let completionRisk = submissionRisk;

  // Final weighted score
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
