export type LmsProviderId = "canvas" | "blackboard" | "moodle";

export type LmsSyncMode = "full" | "incremental" | "events";

export type LmsEntityId = {
  provider: LmsProviderId;
  externalId: string;
};

export type LmsCourseRecord = {
  id: LmsEntityId;
  code: string | null;
  title: string;
  term: string | null;
  updatedAt: string | null;
};

export type LmsAssignmentRecord = {
  id: LmsEntityId;
  courseId: LmsEntityId;
  title: string;
  dueAt: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
};

export type LmsSubmissionRecord = {
  id: LmsEntityId;
  assignmentId: LmsEntityId;
  studentId: string;
  submittedAt: string | null;
  status: "submitted" | "late" | "missing" | "excused" | "unknown";
  sourceUrl: string | null;
};

export type LmsGradeRecord = {
  id: LmsEntityId;
  submissionId: LmsEntityId;
  score: number | null;
  gradedAt: string | null;
};

export type LmsTimingEvent = {
  id: LmsEntityId;
  submissionId: LmsEntityId;
  eventType: "submitted" | "opened" | "viewed" | "graded";
  occurredAt: string;
  source: string;
};

export type LmsEngagementEvent = {
  id: LmsEntityId;
  courseId: LmsEntityId;
  studentId: string;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type LmsSyncCursor = {
  provider: LmsProviderId;
  courseId: string;
  state: string;
  updatedAt: string;
};

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

export type LmsSyncResult = {
  provider: LmsProviderId;
  summary: LmsSyncSummary;
  warnings: string[];
};

export type LmsConnectionRecord = {
  institutionId: string;
  institutionSlug?: string | null;
  provider: LmsProviderId;
  baseUrl: string;
  enabled: boolean;
  accessTokenSecretName?: string | null;
  metadata?: Record<string, unknown>;
};

export type LmsSyncRunRecord = {
  id: string;
  institutionId: string;
  provider: LmsProviderId;
  syncMode: LmsSyncMode;
  status: "queued" | "running" | "succeeded" | "failed";
  summary: LmsSyncSummary;
  warnings: string[];
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};
