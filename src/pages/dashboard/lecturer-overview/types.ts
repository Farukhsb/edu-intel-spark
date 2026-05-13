export interface LecturerOverviewStats {
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  avgScore: number | null;
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

export type LecturerOverviewDistributionBand = {
  label: string;
  count: number;
  fill: string;
};

export interface LecturerOverviewPipelineStage {
  label: string;
  count: number;
  detail: string;
}
