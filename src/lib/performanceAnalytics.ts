import type { AtRiskStudent, StudentTrajectory } from "@/lib/studentRisk";

export interface PerformanceAssignmentLike {
  id: string;
  title: string;
  module_code: string | null;
}

export interface PerformanceSubmissionLike {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
}

export interface PerformanceGradeLike {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
}

export interface GradeDistributionEntry {
  band: string;
  count: number;
  percentage: number;
  fill: string;
}

export interface AssessmentTrendEntry {
  name: string;
  avgGrade: number;
  participation: number;
}

export interface PerformanceProjection {
  modules: string[];
  assessmentTrends: AssessmentTrendEntry[];
  gradeDist: GradeDistributionEntry[];
  atRiskStudents: AtRiskStudent[];
}

export interface PerformanceReportingReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export type RiskFilterValue = "all" | "high-plus" | AtRiskStudent["riskLevel"];
export type ScoreBandFilterValue = "all" | "lt40" | "40-49" | "50-59" | "60plus";
type AtRiskStudentFilterKey = `${RiskFilterValue}|${ScoreBandFilterValue}`;

const GRADE_BANDS: Array<{ band: string; fill: string; matches: (score: number) => boolean }> = [
  { band: "1st (70-100%)", fill: "hsl(152, 56%, 45%)", matches: (score) => score >= 70 },
  { band: "2:1 (60-69%)", fill: "hsl(205, 80%, 55%)", matches: (score) => score >= 60 && score < 70 },
  { band: "2:2 (50-59%)", fill: "hsl(38, 92%, 60%)", matches: (score) => score >= 50 && score < 60 },
  { band: "3rd (40-49%)", fill: "hsl(280, 55%, 55%)", matches: (score) => score >= 40 && score < 50 },
  { band: "Fail (<40%)", fill: "hsl(0, 72%, 55%)", matches: (score) => score < 40 },
];

const toNumericScore = (grade: PerformanceGradeLike) => Number(grade.final_score ?? grade.ai_score);
const RISK_FILTER_VALUES: RiskFilterValue[] = ["all", "high-plus", "critical", "high", "moderate"];
const SCORE_BAND_FILTER_VALUES: ScoreBandFilterValue[] = ["all", "lt40", "40-49", "50-59", "60plus"];

const getScoreBandFilterValue = (avgGrade: number): Exclude<ScoreBandFilterValue, "all"> =>
  avgGrade < 40 ? "lt40" : avgGrade < 50 ? "40-49" : avgGrade < 60 ? "50-59" : "60plus";

const getRiskFilterValues = (riskLevel: AtRiskStudent["riskLevel"]): RiskFilterValue[] =>
  riskLevel === "critical" || riskLevel === "high" ? ["all", "high-plus", riskLevel] : ["all", riskLevel];

const getCombinedFilterKey = (riskFilter: RiskFilterValue, scoreBandFilter: ScoreBandFilterValue): AtRiskStudentFilterKey =>
  `${riskFilter}|${scoreBandFilter}`;

export interface AtRiskStudentFilterIndex {
  riskBuckets: Record<RiskFilterValue, AtRiskStudent[]>;
  scoreBandBuckets: Record<ScoreBandFilterValue, AtRiskStudent[]>;
  combinedBuckets: Map<AtRiskStudentFilterKey, AtRiskStudent[]>;
}

export const buildAtRiskStudentFilterIndex = (students: AtRiskStudent[]): AtRiskStudentFilterIndex => {
  const riskBuckets = {
    all: [] as AtRiskStudent[],
    "high-plus": [] as AtRiskStudent[],
    critical: [] as AtRiskStudent[],
    high: [] as AtRiskStudent[],
    moderate: [] as AtRiskStudent[],
  };

  const scoreBandBuckets = {
    all: [] as AtRiskStudent[],
    lt40: [] as AtRiskStudent[],
    "40-49": [] as AtRiskStudent[],
    "50-59": [] as AtRiskStudent[],
    "60plus": [] as AtRiskStudent[],
  };

  const combinedBuckets = new Map<AtRiskStudentFilterKey, AtRiskStudent[]>();

  RISK_FILTER_VALUES.forEach((riskFilter) => {
    SCORE_BAND_FILTER_VALUES.forEach((scoreBandFilter) => {
      combinedBuckets.set(getCombinedFilterKey(riskFilter, scoreBandFilter), []);
    });
  });

  students.forEach((student) => {
    const scoreBandFilter = getScoreBandFilterValue(student.avgGrade);
    const riskFilterValues = getRiskFilterValues(student.riskLevel);
    const scoreFilterValues: ScoreBandFilterValue[] = ["all", scoreBandFilter];

    riskBuckets.all.push(student);
    riskBuckets[student.riskLevel].push(student);
    if (student.riskLevel === "critical" || student.riskLevel === "high") {
      riskBuckets["high-plus"].push(student);
    }

    scoreBandBuckets.all.push(student);
    scoreBandBuckets[scoreBandFilter].push(student);

    riskFilterValues.forEach((riskFilter) => {
      scoreFilterValues.forEach((scoreFilter) => {
        combinedBuckets.get(getCombinedFilterKey(riskFilter, scoreFilter))!.push(student);
      });
    });
  });

  return {
    riskBuckets,
    scoreBandBuckets,
    combinedBuckets,
  };
};

export const EMPTY_GRADE_DIST: GradeDistributionEntry[] = GRADE_BANDS.map((entry) => ({
  band: entry.band,
  count: 0,
  percentage: 0,
  fill: entry.fill,
}));

export const buildGradeDistribution = (scores: number[]): GradeDistributionEntry[] => {
  const total = scores.length || 1;

  return GRADE_BANDS.map((entry) => {
    const count = scores.filter(entry.matches).length;
    return {
      band: entry.band,
      count,
      percentage: Math.round((count / total) * 100),
      fill: entry.fill,
    };
  });
};

export const buildPerformanceProjection = ({
  assignments,
  submissions,
  grades,
  moduleFilter,
  computeRisk,
}: {
  assignments: PerformanceAssignmentLike[];
  submissions: PerformanceSubmissionLike[];
  grades: PerformanceGradeLike[];
  moduleFilter: string;
  computeRisk: (trajectory: StudentTrajectory) => AtRiskStudent | null;
}): PerformanceProjection => {
  const modules = Array.from(
    new Set(assignments.map((assignment) => assignment.module_code).filter(Boolean) as string[]),
  );

  const filteredAssignments =
    moduleFilter === "all"
      ? assignments
      : assignments.filter((assignment) => assignment.module_code === moduleFilter);
  const filteredAssignmentIds = new Set(filteredAssignments.map((assignment) => assignment.id));
  const filteredSubmissions = submissions.filter((submission) => filteredAssignmentIds.has(submission.assignment_id));
  const filteredSubmissionIds = new Set(filteredSubmissions.map((submission) => submission.id));
  const filteredGrades = grades.filter((grade) => filteredSubmissionIds.has(grade.submission_id));

  const assignmentMap = new Map(filteredAssignments.map((assignment) => [assignment.id, assignment]));
  const gradeBySubmission: Record<string, number> = {};
  for (const grade of filteredGrades) {
    const score = toNumericScore(grade);
    if (!Number.isNaN(score)) {
      gradeBySubmission[grade.submission_id] = score;
    }
  }

  const orderedSubmissionRecords: Array<{
    assignment: PerformanceAssignmentLike;
    submission: PerformanceSubmissionLike;
    score: number | undefined;
  }> = [];

  for (const submission of filteredSubmissions) {
    const assignment = assignmentMap.get(submission.assignment_id);
    if (!assignment) continue;

    orderedSubmissionRecords.push({
      assignment,
      submission,
      score: gradeBySubmission[submission.id],
    });
  }

  orderedSubmissionRecords.sort(
    (left, right) =>
      new Date(left.submission.submitted_at).getTime() - new Date(right.submission.submitted_at).getTime(),
  );

  const perAssignment: Record<string, { scores: number[]; totalSubs: number }> = {};
  const trajectories: Record<string, StudentTrajectory> = {};
  const allScores: number[] = [];

  orderedSubmissionRecords.forEach(({ assignment, submission, score }) => {
    if (!perAssignment[assignment.title]) {
      perAssignment[assignment.title] = { scores: [], totalSubs: 0 };
    }

    perAssignment[assignment.title].totalSubs++;

    if (score != null) {
      perAssignment[assignment.title].scores.push(score);
      allScores.push(score);
    }

    const key = submission.student_id || submission.student_email || submission.student_name || "unknown";
    if (!trajectories[key]) {
      trajectories[key] = {
        name: submission.student_name || submission.student_email || "Unknown Student",
        email: submission.student_email,
        studentId: key,
        scores: [],
      };
    }

    if (score != null) {
      trajectories[key].scores.push({
        score,
        date: submission.submitted_at,
        assignmentTitle: assignment.title,
      });
    }
  });

  const assessmentTrends = Object.entries(perAssignment).map(([name, data]) => ({
    name,
    avgGrade:
      data.scores.length > 0
        ? Math.round(data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length)
        : 0,
    participation:
      filteredSubmissions.length > 0 ? Math.round((data.totalSubs / filteredSubmissions.length) * 100) : 0,
  }));

  const atRiskStudents = Object.values(trajectories)
    .map((trajectory) => computeRisk(trajectory))
    .filter((student): student is AtRiskStudent => student !== null)
    .sort((left, right) => right.riskScore - left.riskScore);

  return {
    modules,
    assessmentTrends,
    gradeDist: buildGradeDistribution(allScores),
    atRiskStudents,
  };
};

export const filterAtRiskStudents = ({
  students,
  riskFilter,
  scoreBandFilter,
  index,
}: {
  students: AtRiskStudent[];
  riskFilter: RiskFilterValue;
  scoreBandFilter: ScoreBandFilterValue;
  index?: AtRiskStudentFilterIndex;
}) => {
  const filterIndex = index ?? buildAtRiskStudentFilterIndex(students);
  return filterIndex.combinedBuckets.get(getCombinedFilterKey(riskFilter, scoreBandFilter)) ?? [];
};

export const getPerformanceReportingReadiness = ({
  assessmentTrends,
  atRiskStudents,
  gradeDist,
}: {
  assessmentTrends: AssessmentTrendEntry[];
  atRiskStudents: AtRiskStudent[];
  gradeDist: GradeDistributionEntry[];
}): PerformanceReportingReadiness => {
  const criticalStudents = atRiskStudents.filter((student) => student.riskLevel === "critical");
  const highStudents = atRiskStudents.filter((student) => student.riskLevel === "high");
  const failingBand = gradeDist.find((entry) => entry.band === "Fail (<40%)");
  const weakestAssessment = assessmentTrends.reduce<AssessmentTrendEntry | null>(
    (currentWeakest, currentAssessment) =>
      currentWeakest === null || currentAssessment.avgGrade < currentWeakest.avgGrade
        ? currentAssessment
        : currentWeakest,
    null,
  );

  return {
    postureLabel:
      criticalStudents.length > 0 || (failingBand?.count ?? 0) > 0
        ? "Immediate intervention position"
        : highStudents.length > 0 || (weakestAssessment?.avgGrade ?? 100) < 55
          ? "Watch list position"
          : "Stable monitoring position",
    likelyChallenge:
      weakestAssessment?.name ||
      (criticalStudents.length > 0
        ? "Critical student trajectory risk"
        : "No performance pressure point yet"),
    bestNextAction:
      criticalStudents.length > 0 || highStudents.length > 0
        ? "Open early support signals and act on high-risk students"
        : weakestAssessment && weakestAssessment.avgGrade < 60
          ? "Review the weakest assessment before the next release cycle"
          : "Maintain current performance monitoring",
  };
};
