import type { StudentRiskEvaluation } from "./studentRisk";

type RiskBand = "low" | "medium" | "high";

export type StudentEngagementSignal = {
  eventCount: number;
  lastEventAt: string | null;
};

export type StudentSubmissionSignal = {
  totalAssignments: number;
  submittedAssignments: number;
  lateSubmissions: number;
};

export type StudentRiskCompositeInput = {
  academicEvaluation: StudentRiskEvaluation | null;
  engagement: StudentEngagementSignal;
  submissions: StudentSubmissionSignal;
  referenceDate: string;
};

export type StudentRiskCompositeEvaluation = {
  rawRiskScore: number;
  riskBand: RiskBand;
  reasonCodes: string[];
  flags: string[];
  explanation: string;
  componentScores: {
    academic: number | null;
    engagement: number | null;
    nonSubmission: number | null;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(olderDate: string, newerDate: string) {
  const older = new Date(olderDate).getTime();
  const newer = new Date(newerDate).getTime();
  if (!Number.isFinite(older) || !Number.isFinite(newer)) return null;
  return Math.max(0, Math.floor((newer - older) / (1000 * 60 * 60 * 24)));
}

function scoreEngagement(engagement: StudentEngagementSignal, referenceDate: string) {
  if (engagement.eventCount === 0 && !engagement.lastEventAt) {
    return {
      score: null as number | null,
      reasonCodes: ["no_engagement_events"],
      flags: ["No LMS engagement activity recorded"],
    };
  }

  let score = 20;
  const reasonCodes: string[] = [];
  const flags: string[] = [];

  if (engagement.eventCount === 0) {
    score = 80;
    reasonCodes.push("no_engagement_events");
    flags.push("No LMS engagement activity recorded");
  } else if (engagement.eventCount < 3) {
    score = 65;
    reasonCodes.push("low_engagement_volume");
    flags.push("Very low LMS engagement volume");
  } else if (engagement.eventCount < 8) {
    score = 40;
    reasonCodes.push("light_engagement_volume");
    flags.push("Light LMS engagement volume");
  } else {
    score = 15;
    reasonCodes.push("active_engagement");
    flags.push("Active LMS engagement");
  }

  if (engagement.lastEventAt) {
    const inactivityDays = daysBetween(engagement.lastEventAt, referenceDate);
    if (inactivityDays != null) {
      if (inactivityDays >= 21) {
        score += 20;
        reasonCodes.push("stale_engagement_21d");
        flags.push(`No engagement for ${inactivityDays} days`);
      } else if (inactivityDays >= 14) {
        score += 15;
        reasonCodes.push("stale_engagement_14d");
        flags.push(`No engagement for ${inactivityDays} days`);
      } else if (inactivityDays >= 7) {
        score += 8;
        reasonCodes.push("stale_engagement_7d");
      }
    }
  }

  return {
    score: clamp(score, 0, 100),
    reasonCodes,
    flags,
  };
}

function scoreNonSubmission(submissions: StudentSubmissionSignal) {
  if (submissions.totalAssignments <= 0) {
    return {
      score: null as number | null,
      reasonCodes: ["no_assignment_baseline"],
      flags: ["No assignment baseline available"],
    };
  }

  const coverage = submissions.submittedAssignments / submissions.totalAssignments;
  let score = 15;
  const reasonCodes: string[] = [];
  const flags: string[] = [];

  if (submissions.submittedAssignments === 0) {
    score = 90;
    reasonCodes.push("no_submissions");
    flags.push("No submitted assignments recorded");
  } else if (coverage >= 0.9) {
    score = 10;
    reasonCodes.push("strong_submission_coverage");
  } else if (coverage >= 0.75) {
    score = 30;
    reasonCodes.push("healthy_submission_coverage");
  } else if (coverage >= 0.5) {
    score = 55;
    reasonCodes.push("mixed_submission_coverage");
    flags.push("Moderate submission gaps");
  } else {
    score = 75;
    reasonCodes.push("weak_submission_coverage");
    flags.push("Persistent submission gaps");
  }

  if (submissions.lateSubmissions >= 3) {
    score += 12;
    reasonCodes.push("late_submission_pattern");
    flags.push("Repeated late submissions");
  } else if (submissions.lateSubmissions > 0 && submissions.lateSubmissions / Math.max(submissions.submittedAssignments, 1) >= 0.4) {
    score += 8;
    reasonCodes.push("frequent_late_submissions");
    flags.push("Frequent late submissions");
  }

  return {
    score: clamp(score, 0, 100),
    reasonCodes,
    flags,
  };
}

function normalizeWeights(weights: Array<number | null>) {
  const total = weights.reduce((sum: number, value) => sum + (value ?? 0), 0);
  return total > 0 ? weights.map((value) => (value ?? 0) / total) : weights.map(() => 0);
}

export function evaluateCompositeStudentRisk(input: StudentRiskCompositeInput): StudentRiskCompositeEvaluation | null {
  const academicScore = input.academicEvaluation?.rawRiskScore ?? null;
  const engagementScore = scoreEngagement(input.engagement, input.referenceDate);
  const nonSubmissionScore = scoreNonSubmission(input.submissions);

  const scoreEntries = [
    academicScore != null ? { name: "academic", score: academicScore, weight: 0.5 } : null,
    engagementScore.score != null ? { name: "engagement", score: engagementScore.score, weight: 0.25 } : null,
    nonSubmissionScore.score != null ? { name: "nonSubmission", score: nonSubmissionScore.score, weight: 0.25 } : null,
  ].filter((entry): entry is { name: string; score: number; weight: number } => entry != null);

  if (scoreEntries.length === 0) {
    return null;
  }

  const weights = normalizeWeights(scoreEntries.map((entry) => entry.weight));
  const composite = scoreEntries.reduce((sum, entry, index) => sum + entry.score * weights[index], 0);
  const rawRiskScore = clamp(Math.round(composite), 0, 100);
  const riskBand: RiskBand = rawRiskScore >= 70 ? "high" : rawRiskScore >= 45 ? "medium" : "low";

  const reasonCodes = [
    ...(input.academicEvaluation?.reasonCodes ?? []),
    ...engagementScore.reasonCodes,
    ...nonSubmissionScore.reasonCodes,
  ];

  const flags = [
    ...(input.academicEvaluation?.flags ?? []),
    ...engagementScore.flags,
    ...nonSubmissionScore.flags,
  ];

  const explanationParts: string[] = [];
  if (input.academicEvaluation) {
    explanationParts.push(`Academic signal ${Math.round(input.academicEvaluation.rawRiskScore)}%`);
  }
  if (engagementScore.score != null) {
    explanationParts.push(`engagement signal ${Math.round(engagementScore.score)}%`);
  }
  if (nonSubmissionScore.score != null) {
    explanationParts.push(`non-submission signal ${Math.round(nonSubmissionScore.score)}%`);
  }
  if (reasonCodes.length > 0) {
    explanationParts.push(`reason codes: ${reasonCodes.join(", ")}`);
  }

  return {
    rawRiskScore,
    riskBand,
    reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["baseline_monitoring"],
    flags,
    explanation: explanationParts.join(". "),
    componentScores: {
      academic: academicScore,
      engagement: engagementScore.score,
      nonSubmission: nonSubmissionScore.score,
    },
  };
}
