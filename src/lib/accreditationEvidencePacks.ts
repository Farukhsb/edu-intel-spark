import type { FeedbackTurnaroundSummary, NSSMetric, QAAMetric, TEFIndicator } from "@/lib/accreditationMetrics";

type AccreditationSummary = {
  overallCompliance: number;
  metCount: number;
  atRiskCount: number;
  belowCount: number;
  nssAverage: number;
  nssBenchmarkAverage: number;
  weakestQaaMetric?: QAAMetric;
  weakestTefIndicator?: TEFIndicator;
};

type AccreditationEvidenceInput = {
  institutionName?: string | null;
  generatedAt?: string;
  qaaMetrics: QAAMetric[];
  nssMetrics: NSSMetric[];
  tefIndicators: TEFIndicator[];
  feedbackTurnaround: FeedbackTurnaroundSummary;
  summary: AccreditationSummary;
};

const metricById = (metrics: QAAMetric[], id: string) => metrics.find((metric) => metric.id === id);

const formatPercent = (value: number | null | undefined) => `${value ?? 0}%`;

const toMarkdownTable = (headers: string[], rows: string[][]) => {
  const escaped = (value: string) => value.split("|").join("\\|");
  return [
    `| ${headers.map(escaped).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escaped).join(" | ")} |`),
  ].join("\n");
};

const narrativeLead = (summary: AccreditationSummary) => {
  if (summary.overallCompliance >= 85) {
    return "The current evidence set shows a strong overall position with most QAA-style indicators meeting target.";
  }

  if (summary.overallCompliance >= 70) {
    return "The current evidence set is broadly stable but retains enough pressure points to justify focused improvement activity.";
  }

  return "The current evidence set shows material pressure across the main quality indicators and should be accompanied by a clear improvement plan.";
};

const continuationNarrative = ({
  completionMetric,
  engagementMetric,
  nssMetric,
}: {
  completionMetric: QAAMetric | undefined;
  engagementMetric: QAAMetric | undefined;
  nssMetric: NSSMetric | undefined;
}) => {
  const completion = completionMetric?.value ?? 0;
  const engagement = engagementMetric?.value ?? 0;
  const nssScore = nssMetric?.score ?? 0;

  return [
    `Continuation evidence is currently anchored in assessment completion and engagement patterns within the live platform dataset.`,
    `Assessment completion rate is ${completion}%, which indicates the share of planned assessment activity that reached submission.`,
    `Student engagement is ${engagement}%, and the closest satisfaction proxy in the current dataset is the NSS-style organisation score of ${nssScore}%.`,
    `This pack should be read alongside institutional continuation records and target-group breakdowns where those are available.`,
  ].join(" ");
};

const completionNarrative = ({
  gradeReleaseMetric,
  turnaroundSummary,
  moderationMetric,
}: {
  gradeReleaseMetric: QAAMetric | undefined;
  turnaroundSummary: FeedbackTurnaroundSummary;
  moderationMetric: QAAMetric | undefined;
}) => {
  const release = gradeReleaseMetric?.value ?? 0;
  const moderation = moderationMetric?.value ?? 0;

  return [
    `Completion evidence draws on assessment workflow completion, feedback timeliness, and moderation coverage.`,
    `Grade release rate is ${release}%, with an average feedback turnaround of ${turnaroundSummary.avg} days against a ${turnaroundSummary.target}-day target.`,
    `Moderation evidence currently stands at ${moderation}%, which supports the institutional record that grading and review work is being completed rather than left pending.`,
  ].join(" ");
};

const progressionNarrative = ({
  passRateMetric,
  averageScoreMetric,
  tefIndicator,
}: {
  passRateMetric: QAAMetric | undefined;
  averageScoreMetric: QAAMetric | undefined;
  tefIndicator: TEFIndicator | undefined;
}) => {
  const passRate = passRateMetric?.value ?? 0;
  const averageScore = averageScoreMetric?.value ?? 0;
  const tefScore = tefIndicator?.score ?? 0;

  return [
    `Progression evidence is represented here by outcome strength and the broader TEF-style student outcome signal in the current dataset.`,
    `Pass rate is ${passRate}% and the average assessment score is ${averageScore}%, indicating the level of academic attainment feeding into progression decisions.`,
    `The weakest available TEF indicator is ${tefIndicator?.name ?? "not available"} at ${tefScore}%, so that is the first narrative line likely to need explanation in a submission.`,
  ].join(" ");
};

export const buildOfsB3EvidencePackMarkdown = (input: AccreditationEvidenceInput) => {
  const completionMetric = metricById(input.qaaMetrics, "completion");
  const gradeReleaseMetric = metricById(input.qaaMetrics, "grade-release");
  const moderationMetric = metricById(input.qaaMetrics, "moderation");
  const passRateMetric = metricById(input.qaaMetrics, "pass-rate");
  const averageScoreMetric = metricById(input.qaaMetrics, "avg-score");
  const engagementMetric = metricById(input.qaaMetrics, "graded");
  const nssMetric = input.nssMetrics.find((metric) => metric.question.includes("course is well organised"));

  const rows = [
    ["Continuation", formatPercent(completionMetric?.value), completionMetric?.detail || "No completion metric available", continuationNarrative({ completionMetric, engagementMetric, nssMetric })],
    ["Completion", formatPercent(gradeReleaseMetric?.value), gradeReleaseMetric?.detail || "No release metric available", completionNarrative({ gradeReleaseMetric, turnaroundSummary: input.feedbackTurnaround, moderationMetric })],
    ["Progression", formatPercent(passRateMetric?.value), passRateMetric?.detail || "No progression metric available", progressionNarrative({ passRateMetric, averageScoreMetric, tefIndicator: input.summary.weakestTefIndicator })],
  ];

  const snapshotRows = input.qaaMetrics.map((metric) => [
    metric.metric,
    `${metric.value}%`,
    `${metric.target}%`,
    metric.status,
    metric.detail,
  ]);

  return [
    "# OfS B3 Evidence Pack",
    `Institution: ${input.institutionName || "GradeAI institution"}`,
    `Generated: ${input.generatedAt || new Date().toISOString().slice(0, 10)}`,
    "",
    "## Purpose",
    "This pack assembles the current live evidence set for continuation, completion, and progression review. It is designed for institutional quality assurance and OfS-facing narrative preparation.",
    "",
    "## Executive Summary",
    narrativeLead(input.summary),
    "",
    "## B3 Narrative",
    toMarkdownTable(["Theme", "Key signal", "Evidence line", "Narrative"], rows),
    "",
    "## Supporting Metrics",
    toMarkdownTable(["Metric", "Value", "Target", "Status", "Detail"], snapshotRows),
    "",
    "## Evidence Notes",
    "- Continuation and progression should be read alongside institutional cohort and destination data where available.",
    "- Completion evidence here reflects grading workflow completion and feedback turnaround in the platform dataset.",
    "- The pack can be appended to with programme-specific analysis before submission.",
  ].join("\n");
};

export const buildTefNarrativeSubmissionMarkdown = (input: AccreditationEvidenceInput) => {
  const indicators = input.tefIndicators.map((indicator) => [
    indicator.name,
    indicator.rating,
    `${indicator.score}%`,
    indicator.detail,
  ]);

  const strongest = [...input.tefIndicators].sort((left, right) => right.score - left.score)[0];
  const weakest = input.summary.weakestTefIndicator;

  return [
    "# TEF Narrative Submission Pack",
    `Institution: ${input.institutionName || "GradeAI institution"}`,
    `Generated: ${input.generatedAt || new Date().toISOString().slice(0, 10)}`,
    "",
    "## Narrative Position",
    "This pack turns the live teaching, assessment, and engagement indicators into a readable TEF narrative scaffold. It is intended for submission drafting and quality review, not as a substitute for institutional source evidence.",
    "",
    "## Teaching & Learning Narrative",
    `Teaching quality is currently strongest where rubric clarity, feedback quality, and organisation are working together to produce a ${input.summary.overallCompliance}% overall compliance position.`,
    `The strongest indicator is ${strongest?.name || "not available"} at ${strongest?.score ?? 0}% (${strongest?.rating || "pending"}), while the weakest indicator is ${weakest?.name || "not available"} at ${weakest?.score ?? 0}%.`,
    "",
    "## Student Outcomes Narrative",
    `Average NSS-style satisfaction sits at ${input.summary.nssAverage}% against a benchmark average of ${input.summary.nssBenchmarkAverage}%.`,
    `Pass rate and average assessment score provide the current outcome line for the TEF submission: use the student outcomes section to explain where gains are being made and where institutional intervention is still required.`,
    "",
    "## Assessment and Feedback Narrative",
    `Feedback turnaround averages ${input.feedbackTurnaround.avg} days, with ${input.feedbackTurnaround.compliant}/${input.feedbackTurnaround.total} submissions meeting the ${input.feedbackTurnaround.target}-day target.`,
    "That evidence supports the narrative that assessment feedback is being issued within a managed window rather than ad hoc.",
    "",
    "## TEF Indicator Table",
    toMarkdownTable(["Indicator", "Rating", "Score", "Detail"], indicators),
    "",
    "## Evidence Notes",
    "- Replace the generic narrative lines with programme-specific narrative before external submission.",
    "- Append institutional context, comparator data, and any external benchmark evidence required by your TEF process.",
    "- Keep the indicator table as an auditable summary of the live dashboard position at the export date.",
  ].join("\n");
};
