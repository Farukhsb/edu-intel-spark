import type { AccreditationMetric, LowPerformingAssessment, ModuleStat } from "@/lib/institutionalInsights";

export function downloadInstitutionalInsightsSnapshot(
  moduleStats: ModuleStat[],
  lowPerforming: LowPerformingAssessment[],
  accreditation: AccreditationMetric[],
) {
  const lines = [
    "Institutional Insights Snapshot",
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Module,Students,Average Grade,Pass Rate",
  ];

  moduleStats.forEach((module) => {
    lines.push(`"${module.module}",${module.students},${module.avgGrade}%,${module.passRate}%`);
  });

  lines.push("");
  lines.push("Assessment,Average Grade,Pass Rate,Students,Issue");
  lowPerforming.forEach((assessment) => {
    lines.push(`"${assessment.name}",${assessment.avgGrade}%,${assessment.passRate}%,${assessment.students},"${assessment.issue}"`);
  });

  lines.push("");
  lines.push("Metric,Value,Target,Status");
  accreditation.forEach((metric) => {
    lines.push(`"${metric.metric}",${metric.value}%,${metric.target}%,${metric.status}`);
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `institutional_insights_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
