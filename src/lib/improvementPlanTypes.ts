export interface ImprovementTask {
  id: string;
  task: string;
  area: string;
  done: boolean;
}

export type PlanTrend = "up" | "down" | "steady";
export type GuidanceMode = "future" | "recovery";

export interface WeakCriterionInsight {
  criterion: string;
  average: number;
  attempts: number;
  feedback?: string;
}

export interface PlanModule {
  module: string;
  currentGrade: number;
  targetGrade: number;
  guidanceMode: GuidanceMode;
  trend: PlanTrend;
  trendDelta: number;
  strengths: string[];
  weaknesses: string[];
  nextSubmissionFocus: string[];
  tasks: ImprovementTask[];
  chart: Array<{ assessment: string; score: number }>;
  weakCriteria: WeakCriterionInsight[];
}

export interface Resource {
  priority: number;
  heading: string;
  duration: string;
  estimatedLift: string;
  guidanceMode: GuidanceMode;
  guidanceLabel: string;
  module: string;
  criterion: string;
  priorityLabel: string;
  priorityScore: number;
  evidenceStrength: "strong" | "moderate" | "limited";
  evidenceBasis: string;
  weakestCriterionSummary: string;
  feedbackSignal: string;
  conceptHint: string | null;
  issue: string;
  actionItems: string[];
  evidenceOfImprovement: string;
}

export interface ImprovementPlanReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export interface AssignmentMetadataRow {
  submission_id: string;
  assignment_id: string;
  title: string | null;
  module_code: string | null;
  max_score: number | null;
}

export interface ImprovementPlanSubmissionLike {
  id: string;
  assignment_id: string;
  submitted_at: string;
}

export interface ImprovementPlanAssignmentLike {
  id: string;
  title: string;
  module_code: string | null;
  max_score: number | null;
}

export interface ImprovementPlanGradeLike {
  submission_id: string;
  final_score?: number | null;
  ai_score?: number | null;
  ai_feedback?: string | null;
  ai_breakdown?: unknown[] | null;
}
