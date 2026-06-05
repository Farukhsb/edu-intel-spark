export type LmsProviderId = "canvas" | "blackboard" | "moodle";

export type LmsSyncMode = "full" | "incremental" | "events";

export type LmsSyncRequest = {
  provider: LmsProviderId;
  institutionId?: string;
  institutionSlug?: string;
  courseId?: string;
  assignmentId?: string;
  syncMode: LmsSyncMode;
};

export type LmsSyncSummary = {
  coursesSynced: number;
  assignmentsSynced: number;
  submissionsSynced: number;
  gradesSynced: number;
  eventsSynced: number;
};

export type LmsSyncResponse = {
  success: boolean;
  provider: LmsProviderId;
  syncMode: LmsSyncMode;
  message: string;
  summary: LmsSyncSummary;
  warnings: string[];
};

export type LmsSyncContext = {
  institutionId: string;
  institutionSlug: string;
  provider: LmsProviderId;
};
