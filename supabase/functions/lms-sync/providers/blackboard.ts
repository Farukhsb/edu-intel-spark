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
} from "../../lms/types.ts";
import type { LmsProviderAdapter } from "../../lms/providers.ts";
import { lmsRestGetPaginatedJson } from "./rest.ts";

type BlackboardConnection = {
  baseUrl: string;
  accessToken: string;
  metadata?: Record<string, unknown> | null;
};

type BlackboardCourse = {
  id?: string | number;
  courseId?: string | number;
  uuid?: string;
  externalId?: string | number;
  name?: string;
  title?: string;
  courseCode?: string;
  courseIdReadable?: string;
  updated?: string | null;
  modified?: string | null;
};

type BlackboardContent = {
  id?: string | number;
  courseId?: string | number;
  title?: string;
  name?: string;
  contentHandler?: string;
  due?: string | null;
  availability?: {
    available?: string | null;
    until?: string | null;
  } | null;
  modified?: string | null;
  contentId?: string | number;
};

type BlackboardSubmission = {
  id?: string | number;
  userId?: string | number;
  courseId?: string | number;
  created?: string | null;
  submitted?: string | null;
  grade?: number | string | null;
  score?: number | null;
  status?: string | null;
  url?: string | null;
  user?: { id?: string | number; name?: string | null; email?: string | null } | null;
};

type BlackboardUser = {
  id?: string | number;
  userId?: string | number;
  name?: string | null;
  email?: string | null;
  lastAccess?: string | null;
  lastModified?: string | null;
};

type BlackboardMetadata = {
  coursesPath?: string;
  courseContentsPathTemplate?: string;
  courseUsersPathTemplate?: string;
  assignmentSubmissionsPathTemplate?: string;
  assignmentGradesPathTemplate?: string;
};

function asMetadata(connection: BlackboardConnection): BlackboardMetadata {
  return (connection.metadata ?? {}) as BlackboardMetadata;
}

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function interpolate(template: string, params: Record<string, string>) {
  return Object.entries(params).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template,
  );
}

function entityId(provider: LmsProviderId, externalId: string) {
  return { provider, externalId };
}

function summary(provider: LmsProviderId): LmsSyncResult {
  return {
    provider,
    summary: {
      coursesSynced: 0,
      assignmentsSynced: 0,
      submissionsSynced: 0,
      gradesSynced: 0,
      eventsSynced: 0,
    },
    warnings: [],
  };
}

function courseExternalId(course: BlackboardCourse) {
  return String(course.courseId ?? course.id ?? course.uuid ?? course.externalId ?? "");
}

function assignmentExternalId(courseId: string, assignment: BlackboardContent) {
  return `${courseId}:${String(assignment.id ?? assignment.contentId ?? assignment.title ?? assignment.name ?? "")}`;
}

function isAssignmentContent(item: BlackboardContent) {
  const handler = (item.contentHandler ?? "").toLowerCase();
  const title = (item.title ?? item.name ?? "").toLowerCase();
  return handler.includes("assignment") || title.includes("assignment") || handler.includes("gradebook");
}

function mapCourse(course: BlackboardCourse): LmsCourseRecord {
  const id = courseExternalId(course);
  return {
    id: entityId("blackboard", id),
    code: course.courseCode ?? course.courseIdReadable ?? null,
    title: course.title ?? course.name ?? id,
    term: null,
    updatedAt: course.modified ?? course.updated ?? null,
  };
}

function mapAssignment(courseId: string, item: BlackboardContent): LmsAssignmentRecord {
  const externalId = assignmentExternalId(courseId, item);
  return {
    id: entityId("blackboard", externalId),
    courseId: entityId("blackboard", courseId),
    title: item.title ?? item.name ?? externalId,
    dueAt: item.due ?? null,
    availableFrom: item.availability?.available ?? null,
    availableUntil: item.availability?.until ?? null,
  };
}

function mapSubmission(assignmentExternalId: string, submission: BlackboardSubmission): LmsSubmissionRecord {
  const [courseId, assignmentId] = assignmentExternalId.split(":", 2);
  const studentId = String(submission.userId ?? submission.user?.id ?? "");
  return {
    id: entityId("blackboard", `${assignmentExternalId}:${studentId}`),
    assignmentId: entityId("blackboard", `${courseId}:${assignmentId}`),
    studentId,
    submittedAt: submission.submitted ?? submission.created ?? null,
    status: submission.status === "late"
      ? "late"
      : submission.status === "missing"
      ? "missing"
      : submission.status === "excused"
      ? "excused"
      : submission.status === "submitted"
      ? "submitted"
      : "unknown",
    sourceUrl: submission.url ?? null,
  };
}

function mapGrade(assignmentExternalId: string, submission: BlackboardSubmission): LmsGradeRecord {
  const [courseId, assignmentId] = assignmentExternalId.split(":", 2);
  const studentId = String(submission.userId ?? submission.user?.id ?? "");
  const score = typeof submission.score === "number"
    ? submission.score
    : typeof submission.grade === "number"
    ? submission.grade
    : null;
  return {
    id: entityId("blackboard", `${assignmentExternalId}:${studentId}:grade`),
    submissionId: entityId("blackboard", `${courseId}:${assignmentId}:${studentId}`),
    score,
    gradedAt: submission.submitted ?? submission.created ?? null,
  };
}

function mapTimingEvents(assignmentExternalId: string, submissions: BlackboardSubmission[]): LmsTimingEvent[] {
  return submissions
    .filter((submission) => Boolean(submission.submitted ?? submission.created))
    .map((submission) => {
      const studentId = String(submission.userId ?? submission.user?.id ?? "");
      return {
        id: entityId("blackboard", `${assignmentExternalId}:${studentId}:submitted`),
        submissionId: entityId("blackboard", `${assignmentExternalId}:${studentId}`),
        eventType: "submitted",
        occurredAt: submission.submitted ?? submission.created ?? new Date().toISOString(),
        source: "blackboard",
      } satisfies LmsTimingEvent;
    });
}

function mapEngagementEvents(courseId: string, users: BlackboardUser[]): LmsEngagementEvent[] {
  return users
    .filter((user) => Boolean(user.lastAccess ?? user.lastModified))
    .map((user) => ({
      id: entityId("blackboard", `${courseId}:${String(user.id ?? user.userId ?? "")}:activity`),
      courseId: entityId("blackboard", courseId),
      studentId: String(user.id ?? user.userId ?? ""),
      eventType: "last_activity",
      occurredAt: user.lastAccess ?? user.lastModified ?? new Date().toISOString(),
      metadata: {
        user_name: user.name ?? null,
        email: user.email ?? null,
      },
    }));
}

function coursePath(connection: BlackboardConnection) {
  return asMetadata(connection).coursesPath ?? "/learn/api/public/v1/courses";
}

function contentsPath(connection: BlackboardConnection, courseId: string) {
  return asMetadata(connection).courseContentsPathTemplate ?? "/learn/api/public/v1/courses/{courseId}/contents";
}

function usersPath(connection: BlackboardConnection, courseId: string) {
  return asMetadata(connection).courseUsersPathTemplate ?? "/learn/api/public/v1/courses/{courseId}/users";
}

function submissionsPath(connection: BlackboardConnection, courseId: string, assignmentId: string) {
  return asMetadata(connection).assignmentSubmissionsPathTemplate ?? "/learn/api/public/v1/courses/{courseId}/gradebook/columns/{assignmentId}/users";
}

function gradesPath(connection: BlackboardConnection, courseId: string, assignmentId: string) {
  return asMetadata(connection).assignmentGradesPathTemplate ?? "/learn/api/public/v1/courses/{courseId}/gradebook/columns/{assignmentId}/users";
}

async function fetchBlackboardCourses(connection: BlackboardConnection) {
  return await lmsRestGetPaginatedJson<BlackboardCourse>(
    buildUrl(connection.baseUrl, coursePath(connection)),
    connection.accessToken,
  );
}

async function fetchBlackboardCourseContents(connection: BlackboardConnection, courseId: string) {
  return await lmsRestGetPaginatedJson<BlackboardContent>(
    buildUrl(connection.baseUrl, interpolate(contentsPath(connection, courseId), { courseId })),
    connection.accessToken,
  );
}

async function fetchBlackboardCourseUsers(connection: BlackboardConnection, courseId: string) {
  return await lmsRestGetPaginatedJson<BlackboardUser>(
    buildUrl(connection.baseUrl, interpolate(usersPath(connection, courseId), { courseId })),
    connection.accessToken,
  );
}

async function fetchBlackboardSubmissions(connection: BlackboardConnection, courseId: string, assignmentId: string) {
  return await lmsRestGetPaginatedJson<BlackboardSubmission>(
    buildUrl(connection.baseUrl, interpolate(submissionsPath(connection, courseId, assignmentId), { courseId, assignmentId })),
    connection.accessToken,
  );
}

async function fetchBlackboardGrades(connection: BlackboardConnection, courseId: string, assignmentId: string) {
  return await lmsRestGetPaginatedJson<BlackboardSubmission>(
    buildUrl(connection.baseUrl, interpolate(gradesPath(connection, courseId, assignmentId), { courseId, assignmentId })),
    connection.accessToken,
  );
}

export function createBlackboardProvider(connection: BlackboardConnection): LmsProviderAdapter {
  return {
    id: "blackboard",
    displayName: "Blackboard",
    supportsLtiLaunch: true,
    supportsEvents: false,
    async sync(request: LmsSyncRequest): Promise<LmsSyncResult> {
      const result = summary("blackboard");
      const courses = request.courseId
        ? (await fetchBlackboardCourses(connection)).filter((course) => courseExternalId(course) === request.courseId)
        : await fetchBlackboardCourses(connection);

      result.summary.coursesSynced = courses.length;

      for (const course of courses) {
        const contents = await fetchBlackboardCourseContents(connection, courseExternalId(course));
        const assignments = contents.filter(isAssignmentContent);
        result.summary.assignmentsSynced += assignments.length;

        if (request.syncMode === "events") {
          const users = await fetchBlackboardCourseUsers(connection, courseExternalId(course));
          result.summary.eventsSynced += mapEngagementEvents(courseExternalId(course), users).length;
          continue;
        }

        for (const assignment of assignments) {
          const assignmentId = assignmentExternalId(courseExternalId(course), assignment);
          const submissions = await fetchBlackboardSubmissions(connection, courseExternalId(course), String(assignment.id ?? assignment.contentId ?? ""));
          const grades = await fetchBlackboardGrades(connection, courseExternalId(course), String(assignment.id ?? assignment.contentId ?? ""));
          result.summary.submissionsSynced += submissions.length;
          result.summary.gradesSynced += grades.length;
          result.summary.eventsSynced += mapTimingEvents(assignmentId, submissions).length;
        }

        const users = await fetchBlackboardCourseUsers(connection, courseExternalId(course));
        result.summary.eventsSynced += mapEngagementEvents(courseExternalId(course), users).length;
      }

      return result;
    },
    async pullCourses() {
      return (await fetchBlackboardCourses(connection)).map(mapCourse);
    },
    async pullAssignments(courseId: string) {
      return (await fetchBlackboardCourseContents(connection, courseId))
        .filter(isAssignmentContent)
        .map((item) => mapAssignment(courseId, item));
    },
    async pullSubmissions(assignmentId: string) {
      const [courseId, blackboardAssignmentId] = assignmentId.split(":", 2);
      return (await fetchBlackboardSubmissions(connection, courseId, blackboardAssignmentId)).map((submission) =>
        mapSubmission(assignmentId, submission)
      );
    },
    async pullGrades(assignmentId: string) {
      const [courseId, blackboardAssignmentId] = assignmentId.split(":", 2);
      return (await fetchBlackboardGrades(connection, courseId, blackboardAssignmentId)).map((submission) =>
        mapGrade(assignmentId, submission)
      );
    },
    async pullTimingEvents(courseId: string) {
      const assignments = await fetchBlackboardCourseContents(connection, courseId);
      const timingEvents: LmsTimingEvent[] = [];
      for (const assignment of assignments.filter(isAssignmentContent)) {
        const assignmentId = String(assignment.id ?? assignment.contentId ?? "");
        const submissionRows = await fetchBlackboardSubmissions(connection, courseId, assignmentId);
        timingEvents.push(...mapTimingEvents(`${courseId}:${assignmentId}`, submissionRows));
      }
      return timingEvents;
    },
    async pullEngagementEvents(courseId: string) {
      return mapEngagementEvents(courseId, await fetchBlackboardCourseUsers(connection, courseId));
    },
  };
}
