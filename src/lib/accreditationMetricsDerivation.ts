import type { FeedbackTurnaroundSummary, NSSMetric, QAAMetric, TEFIndicator } from "@/lib/accreditationMetricsTypes";
import type { AssignmentLike, GradeLike, ProfileLike, SubmissionLike } from "@/lib/accreditationMetricsShared";
import { ensureNumber, ensureString, percentTrend, resolveGradeScore, tefRating } from "@/lib/accreditationMetricsShared";

export const deriveAccreditationMetrics = ({
  grades,
  submissions,
  assignments,
  profiles,
}: {
  grades: GradeLike[];
  submissions: SubmissionLike[];
  assignments: AssignmentLike[];
  profiles: ProfileLike[];
}) => {
  const scores = grades
    .map((grade) => ensureNumber(resolveGradeScore(grade)))
    .filter((score) => Number.isFinite(score));

  const studentCount = profiles.filter((profile) => profile.role === "student").length;
  const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const completionRate =
    submissions.length > 0 && assignments.length > 0 && studentCount > 0
      ? Math.min(Math.round((submissions.length / (assignments.length * studentCount)) * 100), 100)
      : 0;
  const gradedPct = Math.min(Math.round((grades.length / Math.max(submissions.length, 1)) * 100), 100);

  const gradeMap = Object.fromEntries(grades.map((grade) => [grade.submission_id, grade]));
  const turnaroundDays: number[] = [];
  submissions.forEach((submission) => {
    const grade = gradeMap[submission.id];
    const feedbackTimestamp = grade?.reviewed_at ?? grade?.created_at;
    if (feedbackTimestamp && submission.submitted_at) {
      const diff =
        (new Date(feedbackTimestamp).getTime() - new Date(submission.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= 0) turnaroundDays.push(diff);
    }
  });

  const avgTurnaround =
    turnaroundDays.length > 0 ? Math.round(turnaroundDays.reduce((sum, value) => sum + value, 0) / turnaroundDays.length) : 0;
  const compliantCount = turnaroundDays.filter((value) => value <= 15).length;
  const feedbackTurnaround = {
    avg: avgTurnaround,
    target: 15,
    compliant: compliantCount,
    total: turnaroundDays.length,
  } satisfies FeedbackTurnaroundSummary;

  const withRubric = assignments.filter((assignment) => Array.isArray(assignment.rubric) && assignment.rubric.length > 0).length;
  const rubricPct = assignments.length > 0 ? Math.round((withRubric / assignments.length) * 100) : 0;

  const moderated = grades.filter((grade) => grade.reviewed_by || grade.lecturer_score != null).length;
  const moderationPct = grades.length > 0 ? Math.round((moderated / grades.length) * 100) : 0;

  const released = submissions.filter((submission) => submission.status === "released").length;
  const releasedPct = submissions.length > 0 ? Math.round((released / submissions.length) * 100) : 0;

  const qaaMetrics: QAAMetric[] = [
    {
      id: "criteria-transparency",
      category: "Assessment Design",
      metric: "Assessment Criteria Transparency",
      value: rubricPct,
      target: 100,
      status: rubricPct >= 90 ? "met" : rubricPct >= 70 ? "at-risk" : "below",
      detail: `${withRubric}/${assignments.length} assignments have published rubrics`,
    },
    {
      id: "feedback-turnaround",
      category: "Feedback Quality",
      metric: "Feedback Turnaround (<=15 days)",
      value: turnaroundDays.length > 0 ? Math.round((compliantCount / turnaroundDays.length) * 100) : 0,
      target: 90,
      status:
        compliantCount >= turnaroundDays.length * 0.9
          ? "met"
          : compliantCount >= turnaroundDays.length * 0.7
            ? "at-risk"
            : "below",
      detail: `${compliantCount}/${turnaroundDays.length} submissions graded within 15 days (avg: ${avgTurnaround} days)`,
    },
    {
      id: "moderation",
      category: "Quality Assurance",
      metric: "Moderation Evidence",
      value: moderationPct,
      target: 100,
      status: moderationPct >= 90 ? "met" : moderationPct >= 70 ? "at-risk" : "below",
      detail: `${moderated}/${grades.length} grades have lecturer review/moderation`,
    },
    {
      id: "pass-rate",
      category: "Student Outcomes",
      metric: "Module Pass Rate",
      value: passRate,
      target: 75,
      status: passRate >= 75 ? "met" : passRate >= 65 ? "at-risk" : "below",
      detail: `${scores.filter((score) => score >= 40).length}/${scores.length} students passed (>=40%)`,
    },
    {
      id: "completion",
      category: "Student Engagement",
      metric: "Assessment Completion Rate",
      value: completionRate,
      target: 85,
      status: completionRate >= 85 ? "met" : completionRate >= 70 ? "at-risk" : "below",
      detail: `${submissions.length} submissions across ${assignments.length} assignments`,
    },
    {
      id: "grade-release",
      category: "Feedback Quality",
      metric: "Grade Release Rate",
      value: releasedPct,
      target: 95,
      status: releasedPct >= 95 ? "met" : releasedPct >= 80 ? "at-risk" : "below",
      detail: `${released}/${submissions.length} grades released to students`,
    },
    {
      id: "graded",
      category: "Quality Assurance",
      metric: "Graded Submissions",
      value: gradedPct,
      target: 95,
      status: gradedPct >= 95 ? "met" : gradedPct >= 80 ? "at-risk" : "below",
      detail: `${grades.length}/${submissions.length} submissions graded`,
    },
    {
      id: "avg-score",
      category: "Student Outcomes",
      metric: "Average Assessment Score",
      value: avgScore,
      target: 55,
      status: avgScore >= 55 ? "met" : avgScore >= 45 ? "at-risk" : "below",
      detail: "Mean score across all graded submissions",
    },
  ];

  const rubricClarityScore = rubricPct;
  const feedbackTimelinessScore =
    turnaroundDays.length > 0 ? Math.min(Math.round((compliantCount / turnaroundDays.length) * 100), 100) : 0;
  const feedbackHelpfulness = grades.filter((grade) => ensureString(grade.ai_feedback).length > 100).length;
  const feedbackHelpPct = grades.length > 0 ? Math.min(Math.round((feedbackHelpfulness / grades.length) * 100), 100) : 0;
  const organisationScore = assignments.filter((assignment) => assignment.due_date && assignment.description).length;
  const orgPct = assignments.length > 0 ? Math.min(Math.round((organisationScore / assignments.length) * 100), 100) : 0;
  const overallSat = scores.length > 0 ? Math.min(Math.round(avgScore * 1.1), 100) : 0;

  const nssMetrics: NSSMetric[] = [
    { question: "Assessment criteria are clear in advance", score: rubricClarityScore, benchmark: 78, trend: percentTrend(rubricClarityScore, 78) },
    { question: "Feedback has been timely", score: feedbackTimelinessScore, benchmark: 72, trend: percentTrend(feedbackTimelinessScore, 72) },
    { question: "Feedback has helped clarify things", score: feedbackHelpPct, benchmark: 75, trend: percentTrend(feedbackHelpPct, 75) },
    { question: "The course is well organised", score: orgPct, benchmark: 77, trend: percentTrend(orgPct, 77) },
    { question: "Assessment is fair", score: passRate, benchmark: 80, trend: percentTrend(passRate, 80) },
    { question: "Overall satisfaction with quality", score: overallSat, benchmark: 80, trend: percentTrend(overallSat, 80) },
  ];

  const teachingScore = Math.min(Math.round(rubricClarityScore * 0.4 + feedbackHelpPct * 0.3 + orgPct * 0.3), 100);
  const outcomeScore = Math.min(Math.round(passRate * 0.5 + avgScore * 0.5), 100);
  const feedbackScore = Math.min(Math.round(feedbackTimelinessScore * 0.5 + feedbackHelpPct * 0.3 + moderationPct * 0.2), 100);
  const engagementScore = Math.min(Math.round(completionRate * 0.6 + gradedPct * 0.4), 100);

  const tefIndicators: TEFIndicator[] = [
    { name: "Teaching Quality", rating: tefRating(teachingScore), score: teachingScore, detail: `Based on rubric clarity (${rubricClarityScore}%), feedback quality, and organisation` },
    { name: "Student Outcomes", rating: tefRating(outcomeScore), score: outcomeScore, detail: `Pass rate: ${passRate}%, average score: ${avgScore}%` },
    { name: "Assessment & Feedback", rating: tefRating(feedbackScore), score: feedbackScore, detail: `Turnaround compliance: ${feedbackTimelinessScore}%, moderation: ${moderationPct}%` },
    { name: "Student Engagement", rating: tefRating(engagementScore), score: engagementScore, detail: `Completion rate: ${completionRate}%, grading rate: ${gradedPct}%` },
  ];

  const overallCompliance = qaaMetrics.length > 0 ? Math.round((qaaMetrics.filter((metric) => metric.status === "met").length / qaaMetrics.length) * 100) : 0;
  const metCount = qaaMetrics.filter((metric) => metric.status === "met").length;
  const atRiskCount = qaaMetrics.filter((metric) => metric.status === "at-risk").length;
  const belowCount = qaaMetrics.filter((metric) => metric.status === "below").length;
  const nssAverage = nssMetrics.length > 0 ? Math.round(nssMetrics.reduce((sum, metric) => sum + metric.score, 0) / nssMetrics.length) : 0;
  const nssBenchmarkAverage =
    nssMetrics.length > 0 ? Math.round(nssMetrics.reduce((sum, metric) => sum + metric.benchmark, 0) / nssMetrics.length) : 0;

  return {
    qaaMetrics,
    nssMetrics,
    tefIndicators,
    feedbackTurnaround,
    overallCompliance,
    metCount,
    atRiskCount,
    belowCount,
    nssAverage,
    nssBenchmarkAverage,
    weakestQaaMetric: [...qaaMetrics].sort((left, right) => left.value - right.value)[0],
    weakestTefIndicator: [...tefIndicators].sort((left, right) => left.score - right.score)[0],
  };
};
