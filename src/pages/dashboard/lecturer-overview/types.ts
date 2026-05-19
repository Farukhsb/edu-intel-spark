export interface LecturerOverviewStats {
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  avgScore: number | null;
  avgScoreScale: number | null;
  activeStudents: number;
  assignmentCount: number;
  onTarget: number;
  atRisk: number;
}

export interface LecturerOverviewRecentSubmission {
  id: string;
  assignment_id: string;
  student_name: string | null;
  file_name: string;
  status: string;
  submitted_at: string;
  assignment_title: string;
  score: number | null;
  max_score: number;
  workflowHref: string;
  workflowLabel: string;
}

export interface LecturerOverviewWorkflowTarget {
  href: string;
  label: string;
}

export interface LecturerOverviewQueueFocus {
  label: string;
  detail: string;
}

export interface LecturerOverviewPipelineStage {
  label: string;
  count: number;
  detail: string;
}

export interface LecturerOverviewState {
  loading: boolean;
  error: string | null;
  stats: LecturerOverviewStats;
  recent: LecturerOverviewRecentSubmission[];
  pipeline: LecturerOverviewPipelineStage[];
  readiness: {
    postureLabel: string;
    likelyChallenge: string;
    bestNextAction: string;
  };
  heroSummary: string;
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
  queueFocus: LecturerOverviewQueueFocus;
}
