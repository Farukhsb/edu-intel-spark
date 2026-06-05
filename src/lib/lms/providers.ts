import type {
  LmsAssignmentRecord,
  LmsCourseRecord,
  LmsEngagementEvent,
  LmsGradeRecord,
  LmsProviderId,
  LmsSubmissionRecord,
  LmsSyncRequest,
  LmsSyncResult,
  LmsTimingEvent,
} from "./types";

export type LmsProviderAdapter = {
  id: LmsProviderId;
  displayName: string;
  supportsLtiLaunch: boolean;
  supportsEvents: boolean;
  sync(request: LmsSyncRequest): Promise<LmsSyncResult>;
  pullCourses(): Promise<LmsCourseRecord[]>;
  pullAssignments(courseId: string): Promise<LmsAssignmentRecord[]>;
  pullSubmissions(assignmentId: string): Promise<LmsSubmissionRecord[]>;
  pullGrades(assignmentId: string): Promise<LmsGradeRecord[]>;
  pullTimingEvents(courseId: string): Promise<LmsTimingEvent[]>;
  pullEngagementEvents(courseId: string): Promise<LmsEngagementEvent[]>;
};

export type LmsProviderRegistry = Record<LmsProviderId, LmsProviderAdapter>;

