import { evaluateStudentRisk, type StudentTrajectory } from "../../../src/lib/studentRisk.ts";
import { evaluateCompositeStudentRisk } from "../../../src/lib/studentRiskComposite.ts";
import { scoreStudentRisk, type RiskModelPrediction } from "../../../src/lib/riskModel.ts";

import {
  buildFallbackAcademicEvaluation,
  buildRiskDetails,
  buildStudentSubmissionSummary,
  buildEngagementSummary,
  type EngagementEventRow,
  type StudentSubmissionSummary,
} from "./helpers.ts";

type AssignmentById = Map<string, { title: string; dueDate: string | null }>;

type RiskBatchPreparationContext = {
  snapshotDate: string;
  featureVersion: string;
  batchGeneratedAt: string;
  assignmentById: AssignmentById;
  submissionsByStudentId: Map<
    string,
    Array<{
      assignment_id: string;
      submitted_at: string | null;
      status: string;
    }>
  >;
  engagementEventsByEmail: Map<string, EngagementEventRow[]>;
  totalAssignments: number;
};

export type PreparedRiskBatchStudent = {
  evaluation: NonNullable<ReturnType<typeof evaluateStudentRisk>>;
  modelPrediction: RiskModelPrediction | null;
  composite: ReturnType<typeof evaluateCompositeStudentRisk> | null;
  snapshotFeatures: ReturnType<typeof buildRiskDetails>;
  riskBand: string;
  academicRiskScore: number;
  compositeRiskScore: number;
  submissionSummary: StudentSubmissionSummary;
  engagementSummary: ReturnType<typeof buildEngagementSummary>;
  modelVersion: string;
};

export function prepareRiskBatchStudent(
  trajectory: StudentTrajectory,
  context: RiskBatchPreparationContext,
): PreparedRiskBatchStudent | null {
  const evaluation =
    trajectory.scores.length > 0
      ? evaluateStudentRisk(trajectory, { referenceDate: `${context.snapshotDate}T23:59:59.999Z` })
      : null;
  const modelPrediction = evaluation
    ? scoreStudentRisk(trajectory, { featureVersion: context.featureVersion, generatedAt: context.batchGeneratedAt })
    : null;
  const resolvedModelVersion = modelPrediction?.modelVersion ?? `heuristic-risk-${context.featureVersion}`;
  const studentSubmissionRows = context.submissionsByStudentId.get(trajectory.studentId) ?? [];
  const submissionSummary = buildStudentSubmissionSummary(
    trajectory.studentId,
    studentSubmissionRows,
    context.assignmentById,
  );
  const engagementSummary = buildEngagementSummary(
    trajectory.email,
    context.engagementEventsByEmail,
    context.snapshotDate,
  );
  const composite = evaluateCompositeStudentRisk({
    academicEvaluation: evaluation,
    engagement: engagementSummary,
    submissions: {
      totalAssignments: context.totalAssignments,
      submittedAssignments: submissionSummary.submittedAssignments,
      lateSubmissions: submissionSummary.lateSubmissions,
    },
    referenceDate: `${context.snapshotDate}T23:59:59.999Z`,
  });

  if (!composite && !evaluation) {
    return null;
  }

  const academicEvaluation = evaluation ?? buildFallbackAcademicEvaluation(trajectory, "low");
  const academicRiskScore = academicEvaluation.rawRiskScore;
  const compositeRiskScore = composite?.rawRiskScore ?? academicRiskScore;
  const riskBand = composite?.riskBand ?? academicEvaluation.riskBand ?? "low";
  const submissionCount = trajectory.scores.length;
  const firstSubmissionAt = trajectory.scores[0]?.date ?? null;
  const lastSubmissionAt = trajectory.scores[trajectory.scores.length - 1]?.date ?? null;

  const snapshotFeatures = buildRiskDetails(academicEvaluation, {
    composite,
    snapshotDate: context.snapshotDate,
    featureVersion: context.featureVersion,
    generatedAt: context.batchGeneratedAt,
    submissionCount,
    scoreCount: submissionCount,
    firstSubmissionAt,
    lastSubmissionAt,
    modelVersion: resolvedModelVersion,
    modelSource: modelPrediction ? "ml" : "heuristic",
    modelConfidence: modelPrediction?.confidence ?? null,
    modelConfidenceScore: modelPrediction?.confidenceScore ?? null,
    modelRiskScore: modelPrediction?.riskScore ?? academicRiskScore,
    modelRiskBand: modelPrediction?.riskBand ?? riskBand,
    modelNeedsReview: modelPrediction?.needsReview ?? null,
    modelReviewReasons: modelPrediction?.reviewReasons ?? null,
    modelProbabilityByBand: modelPrediction?.probabilityByBand ?? null,
    modelFeatureVector: modelPrediction?.featureVector ?? null,
    modelCalibrationMetrics: modelPrediction?.calibrationMetrics ?? null,
    inputSnapshotReference: null,
    engagementEventCount: engagementSummary.eventCount,
    engagementLastEventAt: engagementSummary.lastEventAt,
    totalAssignments: context.totalAssignments,
    submittedAssignments: submissionSummary.submittedAssignments,
    lateSubmissions: submissionSummary.lateSubmissions,
  });

  return {
    evaluation: academicEvaluation,
    modelPrediction,
    composite,
    snapshotFeatures,
    riskBand,
    academicRiskScore,
    compositeRiskScore,
    submissionSummary,
    engagementSummary,
    modelVersion: resolvedModelVersion,
  };
}
