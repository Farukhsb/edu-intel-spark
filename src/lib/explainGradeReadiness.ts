export interface ExplainGradeReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getExplainGradeReadiness = ({
  assignmentLabel,
  band,
  strongestArea,
  topImprovementArea,
}: {
  assignmentLabel: string | null;
  band: string;
  strongestArea: string | null;
  topImprovementArea: { area: string; nextBand: string; pointsNeeded: number } | null;
}): ExplainGradeReadiness => {
  return {
    postureLabel: "Released explanation position",
    likelyChallenge: topImprovementArea
      ? `${assignmentLabel || "This result"} is closest to improving through ${topImprovementArea.area}`
      : `${assignmentLabel || "This result"} is already sitting in the ${band} band`,
    bestNextAction: topImprovementArea
      ? `Use the ${topImprovementArea.area} guidance to work toward ${topImprovementArea.nextBand}`
      : strongestArea
        ? `Keep ${strongestArea} at its current level while maintaining consistency elsewhere`
        : "Review the released breakdown and keep your strongest habits for the next submission",
  };
};
