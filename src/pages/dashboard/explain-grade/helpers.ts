import { safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";
import type { GradeBreakdown as SharedGradeBreakdown } from "@/types";
import type { AcademicGradeBreakdownItem } from "@/types/academic";
import {
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_GRADES,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";
import { log } from "@/lib/logger";
import type { StudentGradeProjectionRow } from "@/lib/studentGradeProjection";

export interface ExplainGradeBreakdown {
  assessment: string;
  totalGrade: number;
  band: string;
  components: { name: string; weight: number; score: number; maxScore: number }[];
  improvementAreas: { area: string; currentBand: string; nextBand: string; pointsNeeded: number; tips: string[] }[];
}

export interface SubmissionRow {
  id: string;
  assignment_id: string | null;
  student_name: string | null;
  file_name: string | null;
  status?: string | null;
  released_at?: string | null;
  updated_at?: string | null;
}

export interface GradeRow {
  id: string;
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
  ai_breakdown: SharedGradeBreakdown[] | null;
}

export interface AssignmentMetadataRow {
  assignment_id: string;
  max_score: number | null;
  module_code: string | null;
  submission_id: string;
  title: string | null;
}

export type ExplainGradeBreakdownItem = AcademicGradeBreakdownItem & SharedGradeBreakdown;

export interface SubmissionOption {
  gradeId: string;
  submissionId: string;
  label: string;
  secondaryLabel: string | null;
  totalGrade: number;
  breakdown: ExplainGradeBreakdown;
}

export const getBreakdownMaxScore = (item: ExplainGradeBreakdownItem) => item.max_score ?? item.maxScore ?? 0;

export const getBand = (pct: number) => {
  if (pct >= 70) return "1st";
  if (pct >= 60) return "2:1";
  if (pct >= 50) return "2:2";
  if (pct >= 40) return "3rd";
  return "Fail";
};

const getNextBand = (band: string) => {
  if (band === "3rd") return "2:2";
  if (band === "2:2") return "2:1";
  if (band === "2:1") return "1st";
  return "1st";
};

const getNextBandThreshold = (band: string) => {
  if (band === "3rd") return 50;
  if (band === "2:2") return 60;
  if (band === "2:1") return 70;
  return 80;
};

const formatReleasedDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const buildGradeSelectorLabels = ({
  assignmentTitle,
  fileName,
  releasedAt,
  score,
}: {
  assignmentTitle?: string | null;
  fileName?: string | null;
  releasedAt?: string | null;
  score: number;
}) => {
  const title = assignmentTitle?.trim();
  const file = fileName?.trim();
  const primaryBase = title || file || "Released grade";
  const releasedDate = formatReleasedDate(releasedAt);
  const secondaryFile = title ? file : null;
  const secondaryParts = [secondaryFile, releasedDate ? `Released ${releasedDate}` : null].filter(Boolean);

  return {
    label: `${primaryBase} — ${score}%`,
    assessment: primaryBase,
    secondaryLabel: secondaryParts.length > 0 ? secondaryParts.join(" · ") : null,
  };

  /*
  const secondaryParts = [file, releasedDate ? `Released ${releasedDate}` : null].filter(Boolean);

  return {
    label: `${primaryBase} — ${score}%`,
    assessment: primaryBase,
    secondaryLabel: secondaryParts.length > 0 ? secondaryParts.join(" · ") : null,
  };
  */
};

export const buildSubmissionOptions = ({
  submissions,
  grades,
  assignmentMetadata,
}: {
  submissions: SubmissionRow[];
  grades: GradeRow[];
  assignmentMetadata: AssignmentMetadataRow[];
}) => {
  const releasedSubs = submissions.filter((submission) => submission.status === "released");
  const subMap = Object.fromEntries(releasedSubs.map((submission) => [submission.id, submission]));
  const assignmentMap = Object.fromEntries(
    assignmentMetadata.map((row) => [row.submission_id, row]),
  ) as Record<string, AssignmentMetadataRow>;

  return grades.flatMap((grade) => {
    if (grade.ai_score == null && grade.final_score == null) return [];
    const breakdownResult = safeParseGradeBreakdown(grade.ai_breakdown);
    if (!breakdownResult.success) {
      log.error("Invalid grade breakdown payload received for ExplainGrade", breakdownResult.error, {
        gradeId: grade.id,
        submissionId: grade.submission_id,
      });
      return [];
    }

    const submission = subMap[grade.submission_id];
    if (!submission) return [];

    const assignment = assignmentMap[grade.submission_id];
    const totalGrade = Number(grade.final_score ?? grade.ai_score ?? 0);
    const breakdown = breakdownResult.data;
    const totalMaxRaw = breakdown.reduce((sum, item) => sum + getBreakdownMaxScore(item), 0);
    if (totalMaxRaw === 0 && import.meta.env.DEV) {
      log.warn("AI breakdown has no max scores; using fallback totalMax = 1", {
        gradeId: grade.id,
      });
    }
    const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

    const components = breakdown.map((item) => ({
      name: item.criterion || item.name || "Unknown",
      weight: Math.round((getBreakdownMaxScore(item) / totalMax) * 100),
      score: Math.round(((item.score ?? 0) / Math.max(getBreakdownMaxScore(item), 1)) * 100),
      maxScore: 100,
    }));

    const improvementAreas = components
      .filter((component) => component.score < 70)
      .sort((left, right) => left.score - right.score)
      .slice(0, 3)
      .map((component) => {
        const band = getBand(component.score);
        const next = getNextBand(band);
        const threshold = getNextBandThreshold(band);
        return {
          area: component.name,
          currentBand: band,
          nextBand: next,
          pointsNeeded: Math.max(threshold - component.score, 0),
          tips: [
            `Focus on strengthening your ${component.name.toLowerCase()} skills`,
            `Review the rubric criteria for ${component.name}`,
            "Seek specific feedback on this area from your lecturer",
          ],
        };
      });

    const labels = buildGradeSelectorLabels({
      assignmentTitle: assignment?.title,
      fileName: submission.file_name,
      releasedAt: submission.released_at ?? submission.updated_at,
      score: totalGrade,
    });

    return [{
      gradeId: grade.id,
      submissionId: grade.submission_id,
      label: labels.label,
      secondaryLabel: labels.secondaryLabel,
      totalGrade,
      breakdown: {
        assessment: labels.assessment,
        totalGrade,
        band: getBand(totalGrade),
        components,
        improvementAreas,
      },
    }];
  });
};

export const buildSubmissionOptionsFromProjection = (projection: StudentGradeProjectionRow[]) =>
  projection.flatMap((row) => {
    if (row.ai_score == null && row.final_score == null) return [];
    const breakdownResult = safeParseGradeBreakdown(row.ai_breakdown);
    if (!breakdownResult.success) {
      log.error("Invalid grade breakdown payload received for ExplainGrade", breakdownResult.error, {
        submissionId: row.submission_id,
      });
      return [];
    }

    const totalGrade = Number(row.final_score ?? row.ai_score ?? 0);
    const breakdown = breakdownResult.data;
    const totalMaxRaw = breakdown.reduce((sum, item) => sum + getBreakdownMaxScore(item), 0);
    if (totalMaxRaw === 0 && import.meta.env.DEV) {
      log.warn("AI breakdown has no max scores; using fallback totalMax = 1", {
        submissionId: row.submission_id,
      });
    }
    const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

    const components = breakdown.map((item) => ({
      name: item.criterion || item.name || "Unknown",
      weight: Math.round((getBreakdownMaxScore(item) / totalMax) * 100),
      score: Math.round(((item.score ?? 0) / Math.max(getBreakdownMaxScore(item), 1)) * 100),
      maxScore: 100,
    }));

    const improvementAreas = components
      .filter((component) => component.score < 70)
      .sort((left, right) => left.score - right.score)
      .slice(0, 3)
      .map((component) => {
        const band = getBand(component.score);
        const next = getNextBand(band);
        const threshold = getNextBandThreshold(band);
        return {
          area: component.name,
          currentBand: band,
          nextBand: next,
          pointsNeeded: Math.max(threshold - component.score, 0),
          tips: [
            `Focus on strengthening your ${component.name.toLowerCase()} skills`,
            `Review the rubric criteria for ${component.name}`,
            "Seek specific feedback on this area from your lecturer",
          ],
        };
      });

    const labels = buildGradeSelectorLabels({
      assignmentTitle: row.assignment_title,
      fileName: row.file_name,
      score: totalGrade,
    });

    return [{
      gradeId: row.submission_id,
      submissionId: row.submission_id,
      label: labels.label,
      secondaryLabel: labels.secondaryLabel,
      totalGrade,
      breakdown: {
        assessment: labels.assessment,
        totalGrade,
        band: getBand(totalGrade),
        components,
        improvementAreas,
      },
    }];
  });

export const DEMO_SUBMISSIONS: SubmissionOption[] = Object.values(DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS)
  .flat()
  .flatMap((submission) => {
    if (submission.status !== "released") return [];
    const assignment = DEMO_STUDENT_ASSIGNMENTS.find((entry) => entry.id === submission.assignment_id);
    const grade = DEMO_STUDENT_ASSIGNMENT_GRADES[submission.id];
    const breakdown = safeParseGradeBreakdown(grade?.ai_breakdown ?? []);
    if (!grade || !breakdown.success) return [];

    const totalGrade = Number(grade.final_score ?? grade.ai_score ?? 0);
    const totalMaxRaw = breakdown.data.reduce((sum, item) => sum + getBreakdownMaxScore(item), 0);
    const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

    const components = breakdown.data.map((item) => ({
      name: item.criterion || item.name || "Unknown",
      weight: Math.round((getBreakdownMaxScore(item) / totalMax) * 100),
      score: Math.round(((item.score ?? 0) / Math.max(getBreakdownMaxScore(item), 1)) * 100),
      maxScore: 100,
    }));

    const improvementAreas = components
      .filter((component) => component.score < 70)
      .sort((left, right) => left.score - right.score)
      .slice(0, 3)
      .map((component) => {
        const band = getBand(component.score);
        const next = getNextBand(band);
        const threshold = getNextBandThreshold(band);
        return {
          area: component.name,
          currentBand: band,
          nextBand: next,
          pointsNeeded: Math.max(threshold - component.score, 0),
          tips: [
            `Focus on strengthening your ${component.name.toLowerCase()} skills`,
            `Review the rubric criteria for ${component.name}`,
            "Use the released lecturer feedback to revise the next submission",
          ],
        };
      });

    const labels = buildGradeSelectorLabels({
      assignmentTitle: assignment?.title,
      fileName: submission.file_name,
      score: totalGrade,
    });

    return [{
      gradeId: grade.id,
      submissionId: submission.id,
      label: labels.label,
      secondaryLabel: labels.secondaryLabel,
      totalGrade,
      breakdown: {
        assessment: labels.assessment,
        totalGrade,
        band: getBand(totalGrade),
        components,
        improvementAreas,
      },
    }];
  });

export const buildDemoGradeResponse = (question: string, breakdown: ExplainGradeBreakdown) => {
  const weakestArea = breakdown.improvementAreas[0];
  const strongestArea = [...breakdown.components].sort((left, right) => right.score - left.score)[0];
  const normalizedQuestion = question.toLowerCase();

  if (normalizedQuestion.includes("why") && normalizedQuestion.includes("grade")) {
    return `You received **${breakdown.totalGrade}% (${breakdown.band})** because your strongest performance was in **${strongestArea?.name || "your best-scoring criterion"}**, while the main drag on your mark was **${weakestArea?.area || "the weakest rubric area"}**. The demo breakdown shows a solid overall submission with a clearer route to improvement in one weaker criterion rather than broad underperformance.`;
  }

  if (normalizedQuestion.includes("improve") || normalizedQuestion.includes("raise")) {
    return `The fastest route upward is **${weakestArea?.area || "the weakest rubric area"}**. In this demo submission, you need roughly **${weakestArea?.pointsNeeded ?? 0} more points** there to move closer to **${weakestArea?.nextBand || "the next band"}**. Focus on:\n\n- ${weakestArea?.tips[0] || "Tightening criterion-specific evidence"}\n- ${weakestArea?.tips[1] || "Matching the rubric language more directly"}\n- ${weakestArea?.tips[2] || "Using the lecturer feedback to revise your approach"}`;
  }

  return `For this demo submission, the key message is:\n\n- Overall result: **${breakdown.totalGrade}% (${breakdown.band})**\n- Strongest area: **${strongestArea?.name || "Top criterion"}** at **${strongestArea?.score ?? 0}%**\n- Main improvement area: **${weakestArea?.area || "Weakest criterion"}**\n\nAsk why the mark landed in this band, or ask how to improve the weakest area, and I’ll answer using the synthetic demo breakdown.`;
};
