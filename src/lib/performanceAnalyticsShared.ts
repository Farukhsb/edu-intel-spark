import type { AtRiskStudent } from "@/lib/studentRisk";

import type {
  AtRiskStudentFilterIndex,
  AtRiskStudentFilterKey,
  GradeDistributionEntry,
  RiskFilterValue,
  ScoreBandFilterValue,
} from "@/lib/performanceAnalyticsTypes";

const GRADE_BANDS: Array<{ band: string; fill: string; matches: (score: number) => boolean }> = [
  { band: "1st (70-100%)", fill: "hsl(152, 56%, 45%)", matches: (score) => score >= 70 },
  { band: "2:1 (60-69%)", fill: "hsl(205, 80%, 55%)", matches: (score) => score >= 60 && score < 70 },
  { band: "2:2 (50-59%)", fill: "hsl(38, 92%, 60%)", matches: (score) => score >= 50 && score < 60 },
  { band: "3rd (40-49%)", fill: "hsl(280, 55%, 55%)", matches: (score) => score >= 40 && score < 50 },
  { band: "Fail (<40%)", fill: "hsl(0, 72%, 55%)", matches: (score) => score < 40 },
];

const RISK_FILTER_VALUES: RiskFilterValue[] = ["all", "high-plus", "critical", "high", "moderate"];
const SCORE_BAND_FILTER_VALUES: ScoreBandFilterValue[] = ["all", "lt40", "40-49", "50-59", "60plus"];

const getScoreBandFilterValue = (avgGrade: number): Exclude<ScoreBandFilterValue, "all"> =>
  avgGrade < 40 ? "lt40" : avgGrade < 50 ? "40-49" : avgGrade < 60 ? "50-59" : "60plus";

const getRiskFilterValues = (riskLevel: AtRiskStudent["riskLevel"]): RiskFilterValue[] =>
  riskLevel === "critical" || riskLevel === "high" ? ["all", "high-plus", riskLevel] : ["all", riskLevel];

const getCombinedFilterKey = (riskFilter: RiskFilterValue, scoreBandFilter: ScoreBandFilterValue): AtRiskStudentFilterKey =>
  `${riskFilter}|${scoreBandFilter}`;

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
