import { evaluateStudentRisk, type StudentTrajectory } from "@/lib/studentRisk";
import type { CohortSignalRiskBand, CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

import { getCohortSignalStudentInitials, getCohortSignalStudentSortPriority, getSlope, getTrend, resolveCohortSignalAssignmentTitle, resolveCohortSignalFailureProbability, resolveCohortSignalInterventionLoggedAt, resolveCohortSignalLatestIntervention, resolveCohortSignalLatestMark, resolveCohortSignalPredictedNext, resolveCohortSignalRiskReasonLabel, resolveCohortSignalRiskReasons, resolveCohortSignalStudentModule, resolveCohortSignalStudentName, resolveCohortSignalSubmissionKey, resolveCohortSignalSuggestedAction } from "./liveDataHelpers";
import { evaluateModel, getConfidenceFromProbability, predictCentroidModel, trainCentroidModel } from "./liveDataModel";
import type { LiveCohortSignalDataset, LiveCohortSignalInput, LiveCohortSignalObservation } from "./liveData.types";

const LIVE_REFERENCE_NOW = new Date().toISOString();

export const buildLiveCohortSignalDataset = ({
  assignments,
  submissions,
  grades,
  interventions,
}: LiveCohortSignalInput): LiveCohortSignalDataset => {
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const gradeBySubmission = new Map(
    grades
      .map((grade) => [grade.submission_id, grade.final_score ?? grade.ai_score] as const)
      .filter(([, score]) => score != null),
  );
  const interventionByStudent = new Map<string, LiveCohortSignalInput["interventions"][number]>();
  interventions.forEach((intervention) => {
    const key = intervention.student_id;
    if (!key) return;

    interventionByStudent.set(key, resolveCohortSignalLatestIntervention(interventionByStudent.get(key), intervention));
  });

  const studentTrajectories = new Map<
    string,
    {
      studentId: string;
      name: string;
      email: string | null;
      module: string;
      scores: Array<{ score: number; date: string; assignmentTitle: string }>;
    }
  >();

  submissions.forEach((submission) => {
    const score = gradeBySubmission.get(submission.id);
    if (score == null) return;

    const key = resolveCohortSignalSubmissionKey(submission);
    const assignment = assignmentById.get(submission.assignment_id);
    const current =
      studentTrajectories.get(key) ?? {
        studentId: submission.student_id || key,
        name: resolveCohortSignalStudentName(submission),
        email: submission.student_email || null,
        module: resolveCohortSignalStudentModule(assignment),
        scores: [],
      };

    current.module = resolveCohortSignalStudentModule(assignment);
    current.scores.push({
      score,
      date: submission.submitted_at,
      assignmentTitle: resolveCohortSignalAssignmentTitle(assignment),
    });
    studentTrajectories.set(key, current);
  });

  const observations: LiveCohortSignalObservation[] = [];
  const bandObservations: Array<{ id: string; features: number[]; label: "low" | "medium" | "high" }> = [];
  const failureObservations: Array<{ id: string; features: number[]; label: "pass" | "fail" }> = [];

  const totalAssignments = assignments.length;

  studentTrajectories.forEach((trajectoryRecord, studentKey) => {
    const orderedScores = [...trajectoryRecord.scores].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const scores = orderedScores.map((entry) => entry.score);

    const averageMark = scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1);
    const latestMark = resolveCohortSignalLatestMark(scores, averageMark);
    const slope = getSlope(scores);
    const trend = getTrend(slope);
    const variance = scores.length >= 2 ? scores.reduce((sum, score) => sum + (score - averageMark) ** 2, 0) / scores.length : 0;
    const missingSubmission = totalAssignments > 0 && scores.length < totalAssignments;
    const intervention = interventionByStudent.get(trajectoryRecord.studentId) ?? interventionByStudent.get(studentKey);
    const interventionLoggedAt = resolveCohortSignalInterventionLoggedAt(intervention);

    const trajectory: StudentTrajectory = {
      studentId: trajectoryRecord.studentId,
      name: trajectoryRecord.name,
      email: trajectoryRecord.email,
      scores: orderedScores.map((entry) => ({
        score: entry.score,
        date: entry.date,
        assignmentTitle: entry.assignmentTitle,
      })),
    };

    const evaluation = evaluateStudentRisk(trajectory, { referenceDate: LIVE_REFERENCE_NOW, staleWindowDays: 30 });
    const reasons = resolveCohortSignalRiskReasons(evaluation?.reasonCodes);
    const suggestedAction = resolveCohortSignalSuggestedAction(evaluation?.recommendation, interventionLoggedAt);

    const featureVector = [averageMark, latestMark, slope, variance, scores.length, missingSubmission ? 1 : 0];

    observations.push({
      id: trajectory.studentId,
      label: averageMark >= 65 ? "low" : averageMark >= 50 ? "medium" : "high",
      features: featureVector,
      trajectory,
      module: trajectoryRecord.module,
      interventionLoggedAt,
      missingSubmission,
      averageMark,
      latestMark,
      trend,
      riskReasons: reasons.map((reason) => resolveCohortSignalRiskReasonLabel(reason)),
      suggestedAction,
      predictedNext: resolveCohortSignalPredictedNext(evaluation?.predictedNext, averageMark),
      failProbability: 0,
    });
  });

  const bandObservationsById = observations.map(({ id, features, label }) => ({
    id,
    features,
    label,
  }));
  const failureObservationsById = observations.map(({ id, features, averageMark }) => ({
    id,
    features,
    label: (averageMark < 50 ? "fail" : "pass") as "pass" | "fail",
  }));

  const bandModel = trainCentroidModel(bandObservationsById, ["low", "medium", "high"]);
  const failureModel = trainCentroidModel(failureObservationsById, ["pass", "fail"]);
  const bandReport = evaluateModel(bandObservationsById, ["low", "medium", "high"]);
  const failureReport = evaluateModel(failureObservationsById, ["pass", "fail"], "fail");

  const students = observations.map((observation) => {
    const bandPrediction = predictCentroidModel(bandModel, observation.features);
    const failurePrediction = predictCentroidModel(failureModel, observation.features);
    const bandLabel = (observation.trajectory.scores.length < 2 ? "insufficient" : bandPrediction.label) as CohortSignalRiskBand;
    const failProbability = resolveCohortSignalFailureProbability(failurePrediction.probabilities);
    const confidence = getConfidenceFromProbability(Math.max(bandPrediction.probability, failurePrediction.probability));

    const riskReasons = [...observation.riskReasons];
    if (observation.missingSubmission) {
      riskReasons.push("Missing one or more submissions");
    }
    if (observation.interventionLoggedAt) {
      riskReasons.push("Intervention already logged");
    }

    return {
      id: observation.id,
      name: observation.trajectory.name,
      initials: getCohortSignalStudentInitials(observation.trajectory.name),
      module: observation.module,
      latestMark: Math.round(observation.latestMark),
      averageMark: Math.round(observation.averageMark),
      riskBand: bandLabel,
      predictedToFail: failurePrediction.label === "fail",
      failProbability,
      trend: observation.trend,
      riskReasons,
      confidence,
      suggestedAction: observation.suggestedAction,
      interventionLoggedAt: observation.interventionLoggedAt,
      missingSubmission: observation.missingSubmission,
    } satisfies CohortSignalStudent;
  });

  students.sort((left, right) => {
    const leftPriority = getCohortSignalStudentSortPriority(left);
    const rightPriority = getCohortSignalStudentSortPriority(right);
    return leftPriority - rightPriority || right.failProbability - left.failProbability;
  });

  return {
    students,
    bandReport,
    failureReport,
  };
};
