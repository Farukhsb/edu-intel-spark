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

type CanvasConnection = {
  baseUrl: string;
  accessToken: string;
};

type CanvasCourse = {
  id: number;
  course_code?: string | null;
  name: string;
  sis_course_id?: string | null;
  term?: { name?: string | null } | null;
  updated_at?: string | null;
};

type CanvasAssignment = {
  id: number;
  course_id: number;
  name: string;
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  points_possible?: number | null;
  updated_at?: string | null;
};

type CanvasSubmission = {
  assignment_id: number;
  user_id: number;
  score?: number | null;
  grade?: string | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  late?: boolean;
  workflow_state?: string | null;
  html_url?: string | null;
  user?: { id?: number; name?: string | null; email?: string | null } | null;
};

type CanvasUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  sis_user_id?: string | null;
  last_activity_at?: string | null;
  created_at?: string | null;
};

function buildCanvasUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function buildCanvasEntityId(provider: LmsProviderId, externalId: string) {
  return { provider, externalId };
}

function parseAssignmentExternalId(externalId: string) {
  const [courseId, assignmentId] = externalId.split(":", 2);
  if (!courseId || !assignmentId) {
    throw new Error(`Canvas assignment id must be encoded as courseId:assignmentId, got "${externalId}"`);
  }
  return { courseId, assignmentId };
}

function createCanvasSyncResult(provider: LmsProviderId): LmsSyncResult {
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

async function fetchCanvasCourses(connection: CanvasConnection) {
  return await lmsRestGetPaginatedJson<CanvasCourse>(
    buildCanvasUrl(connection.baseUrl, "/api/v1/courses?state[]=available&state[]=completed&per_page=100"),
    connection.accessToken,
  );
}

async function fetchCanvasAssignments(connection: CanvasConnection, courseId: string) {
  return await lmsRestGetPaginatedJson<CanvasAssignment>(
    buildCanvasUrl(connection.baseUrl, `/api/v1/courses/${courseId}/assignments?per_page=100`),
    connection.accessToken,
  );
}

async function fetchCanvasSubmissions(connection: CanvasConnection, courseId: string, assignmentId: string) {
  return await lmsRestGetPaginatedJson<CanvasSubmission>(
    buildCanvasUrl(connection.baseUrl, `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100&include[]=user`),
    connection.accessToken,
  );
}

async function fetchCanvasCourseUsers(connection: CanvasConnection, courseId: string) {
  return await lmsRestGetPaginatedJson<CanvasUser>(
    buildCanvasUrl(connection.baseUrl, `/api/v1/courses/${courseId}/users?enrollment_type=student&include[]=email&per_page=100`),
    connection.accessToken,
  );
}

function mapCanvasCourse(course: CanvasCourse): LmsCourseRecord {
  return {
    id: buildCanvasEntityId("canvas", String(course.id)),
    code: course.course_code ?? course.sis_course_id ?? null,
    title: course.name,
    term: course.term?.name ?? null,
    updatedAt: course.updated_at ?? null,
  };
}

function mapCanvasAssignment(course: CanvasCourse, assignment: CanvasAssignment): LmsAssignmentRecord {
  return {
    id: buildCanvasEntityId("canvas", `${course.id}:${assignment.id}`),
    courseId: buildCanvasEntityId("canvas", String(course.id)),
    title: assignment.name,
    dueAt: assignment.due_at ?? null,
    availableFrom: assignment.unlock_at ?? null,
    availableUntil: assignment.lock_at ?? null,
  };
}

function mapCanvasSubmission(assignmentExternalId: string, submission: CanvasSubmission): LmsSubmissionRecord {
  const { courseId, assignmentId } = parseAssignmentExternalId(assignmentExternalId);
  return {
    id: buildCanvasEntityId("canvas", `${courseId}:${assignmentId}:${submission.user_id}`),
    assignmentId: buildCanvasEntityId("canvas", `${courseId}:${assignmentId}`),
    studentId: String(submission.user_id),
    submittedAt: submission.submitted_at ?? null,
    status: submission.workflow_state === "late"
      ? "late"
      : submission.workflow_state === "submitted"
      ? "submitted"
      : submission.workflow_state === "excused"
      ? "excused"
      : submission.workflow_state === "missing"
      ? "missing"
      : "unknown",
    sourceUrl: submission.html_url ?? null,
  };
}

function mapCanvasGrade(assignmentExternalId: string, submission: CanvasSubmission): LmsGradeRecord {
  const { courseId, assignmentId } = parseAssignmentExternalId(assignmentExternalId);
  return {
    id: buildCanvasEntityId("canvas", `${courseId}:${assignmentId}:${submission.user_id}:grade`),
    submissionId: buildCanvasEntityId("canvas", `${courseId}:${assignmentId}:${submission.user_id}`),
    score: typeof submission.score === "number" ? submission.score : null,
    gradedAt: submission.graded_at ?? null,
  };
}

function buildTimingEventsFromSubmissions(
  assignmentExternalId: string,
  submissions: CanvasSubmission[],
): LmsTimingEvent[] {
  return submissions
    .filter((submission) => Boolean(submission.submitted_at))
    .map((submission) => ({
      id: buildCanvasEntityId("canvas", `${assignmentExternalId}:${submission.user_id}:submitted`),
      submissionId: buildCanvasEntityId("canvas", `${assignmentExternalId}:${submission.user_id}`),
      eventType: "submitted",
      occurredAt: submission.submitted_at!,
      source: "canvas",
    }));
}

function buildEngagementEvents(course: CanvasCourse, users: CanvasUser[]): LmsEngagementEvent[] {
  return users
    .filter((user) => Boolean(user.last_activity_at))
    .map((user) => ({
      id: buildCanvasEntityId("canvas", `${course.id}:${user.id}:activity`),
      courseId: buildCanvasEntityId("canvas", String(course.id)),
      studentId: String(user.id),
      eventType: "last_activity",
      occurredAt: user.last_activity_at!,
      metadata: {
        user_name: user.name ?? null,
        email: user.email ?? null,
        sis_user_id: user.sis_user_id ?? null,
      },
    }));
}

export function createCanvasProvider(connection: CanvasConnection): LmsProviderAdapter {
  return {
    id: "canvas",
    displayName: "Canvas",
    supportsLtiLaunch: true,
    supportsEvents: true,
    async sync(request: LmsSyncRequest): Promise<LmsSyncResult> {
      const result = createCanvasSyncResult("canvas");
      const courseFilter = request.courseId ?? null;
      const courses = courseFilter
        ? (await fetchCanvasCourses(connection)).filter((course) => String(course.id) === courseFilter)
        : await fetchCanvasCourses(connection);

      result.summary.coursesSynced = courses.length;

      for (const course of courses) {
        const users = await fetchCanvasCourseUsers(connection, String(course.id));
        result.summary.eventsSynced += buildEngagementEvents(course, users).length;

        if (request.syncMode === "events") {
          continue;
        }

        const assignments = request.assignmentId
          ? (await fetchCanvasAssignments(connection, String(course.id))).filter((assignment) => String(assignment.id) === request.assignmentId)
          : await fetchCanvasAssignments(connection, String(course.id));
        result.summary.assignmentsSynced += assignments.length;

        for (const assignment of assignments) {
          const assignmentExternalId = `${course.id}:${assignment.id}`;
          const submissions = await fetchCanvasSubmissions(connection, String(course.id), String(assignment.id));
          result.summary.submissionsSynced += submissions.length;
          result.summary.gradesSynced += submissions.filter((submission) => typeof submission.score === "number").length;
          result.summary.eventsSynced += buildTimingEventsFromSubmissions(assignmentExternalId, submissions).length;
        }
      }

      return result;
    },
    async pullCourses() {
      return (await fetchCanvasCourses(connection)).map(mapCanvasCourse);
    },
    async pullAssignments(courseId: string) {
      const rawCourses = await fetchCanvasCourses(connection);
      const course = rawCourses.find((item) => String(item.id) === courseId);
      if (!course) return [];
      return (await fetchCanvasAssignments(connection, courseId)).map((assignment) => mapCanvasAssignment(course, assignment));
    },
    async pullSubmissions(assignmentId: string) {
      const { courseId, assignmentId: canvasAssignmentId } = parseAssignmentExternalId(assignmentId);
      return (await fetchCanvasSubmissions(connection, courseId, canvasAssignmentId)).map((submission) =>
        mapCanvasSubmission(assignmentId, submission)
      );
    },
    async pullGrades(assignmentId: string) {
      const { courseId, assignmentId: canvasAssignmentId } = parseAssignmentExternalId(assignmentId);
      const submissions = await fetchCanvasSubmissions(connection, courseId, canvasAssignmentId);
      return submissions.map((submission) => mapCanvasGrade(assignmentId, submission));
    },
    async pullTimingEvents(courseId: string) {
      const assignments = await fetchCanvasAssignments(connection, courseId);
      const timingEvents: LmsTimingEvent[] = [];
      for (const assignment of assignments) {
        const assignmentExternalId = `${courseId}:${assignment.id}`;
        const submissions = await fetchCanvasSubmissions(connection, courseId, String(assignment.id));
        timingEvents.push(...buildTimingEventsFromSubmissions(assignmentExternalId, submissions));
      }
      return timingEvents;
    },
    async pullEngagementEvents(courseId: string) {
      const course = (await fetchCanvasCourses(connection)).find((item) => String(item.id) === courseId);
      if (!course) return [];
      const users = await fetchCanvasCourseUsers(connection, courseId);
      return buildEngagementEvents(course, users);
    },
  };
}

export const canvasProvider = createCanvasProvider({
  baseUrl: "",
  accessToken: "",
});
