import type { CohortAnalyticsSnapshot, CohortRecommendation } from "@/lib/cohortRecommendationsTypes";
import {
  buildRecommendation,
  formatPct,
  highFailureRateId,
  highRiskClusterId,
  integritySpikeId,
  lowCohortAverageId,
  positiveSignalId,
  scoreDropId,
  sortByPriority,
  weakRubricId,
} from "@/lib/cohortRecommendationsShared";

export function buildCohortRecommendations(snapshot: CohortAnalyticsSnapshot): CohortRecommendation[] {
  const recommendations: CohortRecommendation[] = [];
  const latestAssignments = [...snapshot.assignments]
    .filter((assignment) => assignment.gradedCount > 0)
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());

  latestAssignments
    .filter((assignment) => assignment.avgScore < 45)
    .forEach((assignment) => {
      recommendations.push(
        buildRecommendation({
          id: lowCohortAverageId(snapshot.lecturerId, assignment.id),
          type: "performance",
          ruleCode: "low_cohort_average",
          title: "Low cohort average detected",
          summary: `${assignment.title} is averaging ${formatPct(assignment.avgScore)}, below the 45% threshold.`,
          explanation:
            "This recommendation is triggered from the assignment-level cohort average already used in the Cohort Dashboard. It highlights an assessment where overall performance is materially weak.",
          severity: assignment.avgScore < 35 ? "critical" : "high",
          confidence: 0.96,
          recommendedActions: [
            "Review the lowest-performing rubric criteria for this assignment.",
            "Schedule a targeted recap session before the next deadline.",
            "Check whether task instructions or expectations need clarification.",
          ],
          evidence: {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            metrics: [
              { label: "Assignment average", value: formatPct(assignment.avgScore) },
              { label: "Graded submissions", value: String(assignment.gradedCount) },
            ],
          },
          assignmentId: assignment.id,
        }),
      );
    });

  latestAssignments
    .filter((assignment) => assignment.failRate > 35)
    .forEach((assignment) => {
      recommendations.push(
        buildRecommendation({
          id: highFailureRateId(snapshot.lecturerId, assignment.id),
          type: "performance",
          ruleCode: "high_failure_rate",
          title: "High failure rate across the cohort",
          summary: `${formatPct(assignment.failRate)} of graded submissions in ${assignment.title} are below 40%, above the 35% threshold.`,
          explanation:
            "A high failure rate at assignment level is usually a signal to review assessment alignment, support coverage, or rubric clarity.",
          severity: assignment.failRate > 50 ? "critical" : "high",
          confidence: 0.95,
          recommendedActions: [
            "Review failed scripts for recurring misconceptions.",
            "Contact the highest-risk students before the next submission.",
            "Compare pass rates between assignments to isolate where the drop begins.",
          ],
          evidence: {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            metrics: [
              { label: "Failure rate", value: formatPct(assignment.failRate) },
              { label: "Graded submissions", value: String(assignment.gradedCount) },
            ],
          },
          assignmentId: assignment.id,
        }),
      );
    });

  for (let index = 1; index < latestAssignments.length; index++) {
    const previous = latestAssignments[index - 1];
    const current = latestAssignments[index];
    const drop = previous.avgScore - current.avgScore;
    if (drop < 10) continue;

    recommendations.push(
      buildRecommendation({
        id: scoreDropId(snapshot.lecturerId, current.id, previous.id),
        type: "trends",
        ruleCode: "assignment_score_drop",
        title: "Assignment average has dropped sharply",
        summary: `${current.title} is ${Math.round(drop)} points below ${previous.title}.`,
        explanation:
          "A double-digit average drop between adjacent assignments usually indicates a material jump in difficulty, weaker preparation, or misalignment with expectations.",
        severity: drop >= 15 ? "high" : "medium",
        confidence: 0.92,
        recommendedActions: [
          "Review the assessment brief and sample answers with the cohort.",
          "Compare weaker students' performance against the prior task.",
          "Check whether a specific criterion or topic caused the drop.",
        ],
        evidence: {
          assignmentId: current.id,
          assignmentTitle: current.title,
          previousAssignmentId: previous.id,
          previousAssignmentTitle: previous.title,
          metrics: [
            { label: previous.title, value: formatPct(previous.avgScore) },
            { label: current.title, value: formatPct(current.avgScore) },
            { label: "Difference", value: `${Math.round(drop)} pts lower` },
          ],
        },
        assignmentId: current.id,
      }),
    );
  }

  snapshot.criteria
    .filter((criterion) => criterion.averagePercent < 50 && criterion.submissionCount > 0 && criterion.assignmentId)
    .slice(0, 4)
    .forEach((criterion) => {
      recommendations.push(
        buildRecommendation({
          id: weakRubricId(snapshot.lecturerId, criterion.assignmentId!, criterion.key),
          type: "rubric weakness",
          ruleCode: "weak_rubric_criterion",
          title: `Weak rubric area: ${criterion.criterion}`,
          summary: `${criterion.criterion} is averaging ${formatPct(criterion.averagePercent)}, below the 50% threshold.`,
          explanation:
            "This recommendation is based on criterion-level scoring already produced by the grading pipeline. It highlights where performance is weakest, not a separate model judgement.",
          severity: criterion.averagePercent < 35 ? "high" : "medium",
          confidence: 0.9,
          recommendedActions: [
            "Review exemplar responses for this criterion with the cohort.",
            "Add a targeted practice task or mini-workshop for this skill.",
            "Check whether rubric wording needs clarification for students.",
          ],
          evidence: {
            assignmentId: criterion.assignmentId,
            assignmentTitle: criterion.assignmentTitle,
            criterion: criterion.criterion,
            metrics: [
              { label: "Criterion average", value: formatPct(criterion.averagePercent) },
              { label: "Submissions", value: String(criterion.submissionCount) },
            ],
          },
          assignmentId: criterion.assignmentId ?? null,
        }),
      );
    });

  const highRiskCount = snapshot.highRiskStudents.length;
  const highRiskPct =
    snapshot.atRiskStudents.length > 0 ? (highRiskCount / Math.max(snapshot.atRiskStudents.length, 1)) * 100 : 0;

  if (
    highRiskCount >= 8 ||
    (snapshot.atRiskStudents.length > 0 && (highRiskCount / Math.max(snapshot.atRiskStudents.length, 1)) >= 0.15)
  ) {
    const affected = snapshot.highRiskStudents.slice(0, 5);
    recommendations.push(
      buildRecommendation({
        id: highRiskClusterId(snapshot.lecturerId, "all"),
        type: "student risk",
        ruleCode: "high_risk_student_cluster",
        title: "High-risk student cluster detected",
        summary: `${highRiskCount} students are in the high or critical risk band.`,
        explanation:
          "This uses the existing trajectory-based risk engine. The recommendation is triggered when the cluster size is large enough to justify cohort-level intervention planning.",
        severity: highRiskCount >= 12 ? "critical" : "high",
        confidence: 0.94,
        recommendedActions: [
          "Open the risk workflow and prioritise the highest-risk students.",
          "Create targeted check-ins or support referrals for affected students.",
          "Review whether one assignment or topic is driving the risk cluster.",
        ],
        evidence: {
          metrics: [
            { label: "High-risk students", value: String(highRiskCount) },
            { label: "Risk share of flagged cohort", value: formatPct(highRiskPct) },
          ],
          affectedStudentIds: affected.map((student) => student.studentId),
          affectedStudentNames: affected.map((student) => student.name),
        },
        assignmentId: null,
      }),
    );
  }

  snapshot.integrityByAssignment.forEach((assignmentIntegrity) => {
    const integrityThreshold = Math.max(3, Math.ceil(assignmentIntegrity.submissionCount * 0.2));
    if (assignmentIntegrity.flaggedCount < integrityThreshold || assignmentIntegrity.flaggedCount === 0) {
      return;
    }

    recommendations.push(
      buildRecommendation({
        id: integritySpikeId(snapshot.lecturerId, assignmentIntegrity.assignmentId),
        type: "integrity alerts",
        ruleCode: "integrity_spike",
        title: "Integrity flags have spiked",
        summary: `${assignmentIntegrity.flaggedCount} submissions in ${assignmentIntegrity.assignmentTitle} have active integrity concerns, above the current alert threshold of ${integrityThreshold}.`,
        explanation:
          "This is derived from persisted academic integrity review data, including AI-writing, similarity, and baseline-deviation signals already generated elsewhere in the platform.",
        severity: assignmentIntegrity.flaggedCount >= integrityThreshold * 2 ? "critical" : "high",
        confidence: 0.93,
        recommendedActions: [
          "Open the integrity queue and review the highest-risk cases first.",
          "Check whether the spike is clustered around one assignment or cohort segment.",
          "Communicate academic integrity expectations before the next submission.",
        ],
        evidence: {
          assignmentId: assignmentIntegrity.assignmentId,
          assignmentTitle: assignmentIntegrity.assignmentTitle,
          flaggedSubmissionIds: assignmentIntegrity.flaggedSubmissionIds.slice(0, 10),
          metrics: [
            { label: "Flagged submissions", value: String(assignmentIntegrity.flaggedCount) },
            { label: "Alert threshold", value: String(integrityThreshold) },
          ],
        },
        assignmentId: assignmentIntegrity.assignmentId,
      }),
    );
  });

  if (snapshot.gradedCount > 0 && snapshot.cohortAverage >= 70 && snapshot.failRate <= 10) {
    recommendations.push(
      buildRecommendation({
        id: positiveSignalId(snapshot.lecturerId, "all"),
        type: "positive signals",
        ruleCode: "positive_cohort_signal",
        title: "Strong positive cohort signal",
        summary: `The cohort is averaging ${formatPct(snapshot.cohortAverage)} with only ${formatPct(snapshot.failRate)} below pass level.`,
        explanation:
          "Positive recommendations are generated from the same deterministic analytics so lecturers can identify what is working and preserve it.",
        severity: "low",
        confidence: 0.9,
        recommendedActions: [
          "Capture the teaching or assessment practices that contributed to this result.",
          "Use the strongest scripts as exemplars for future cohorts.",
        ],
        evidence: {
          metrics: [
            { label: "Cohort average", value: formatPct(snapshot.cohortAverage) },
            { label: "Failure rate", value: formatPct(snapshot.failRate) },
          ],
        },
        assignmentId: null,
      }),
    );
  }

  return recommendations.sort(sortByPriority);
}
