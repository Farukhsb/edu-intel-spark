import {
  computeRiskLegacy,
  evaluateStudentRiskLegacy,
} from "./studentRiskLegacy.ts";

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

/**
 * @deprecated Use `scoreStudentRisk` from `riskModel.ts` instead.
 * This is a legacy compatibility wrapper.
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

  return evaluateStudentRiskLegacy(trajectory, options);
}

/**
 * @deprecated Use `scoreStudentRisk` from `riskModel.ts` instead.
 * This is a legacy compatibility wrapper.
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

  return computeRiskLegacy(trajectory, options);
}
