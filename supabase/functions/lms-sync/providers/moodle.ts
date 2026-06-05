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
import { lmsRestGetJson } from "./rest.ts";

type MoodleConnection = {
  baseUrl: string;
  accessToken: string;
  metadata?: Record<string, unknown> | null;
};

type MoodleCourse = {
  id: number;
  fullname?: string;
  shortname?: string;
  displayname?: string;
  categoryname?: string | null;
  timemodified?: number | null;
};

type MoodleCourseContent = {
  id?: number;
  name?: string;
  modname?: string;
  url?: string;
  timemodified?: number | null;
  visible?: number | null;
  modules?: MoodleCourseContent[];
  contents?: MoodleCourseContent[];
  instance?: number;
  coursemodule?: number;
};

type MoodleEnrolledUser = {
  id: number;
  fullname?: string | null;
  email?: string | null;
  lastaccess?: number | null;
  timemodified?: number | null;
};

type MoodleAssignmentSubmission = {
  userid?: number;
  id?: number;
  status?: string | null;
  submission?: {
    status?: string | null;
    timemodified?: number | null;
    timecreated?: number | null;
    grading?: {
      grade?: number | string | null;
      grader?: number | null;
      timemodified?: number | null;
    } | null;
  } | null;
  grading?: {
    grade?: number | string | null;
    grader?: number | null;
    timemodified?: number | null;
  } | null;
};

type MoodleMetadata = {
  coursesFunction?: string;
  courseContentsFunction?: string;
  enrolledUsersFunction?: string;
  assignmentSubmissionsFunction?: string;
  assignmentGradesFunction?: string;
};

function asMetadata(connection: MoodleConnection): MoodleMetadata {
  return (connection.metadata ?? {}) as MoodleMetadata;
}

function buildUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/webservice/rest/server.php`;
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

function courseExternalId(course: MoodleCourse) {
  return String(course.id);
}

function assignmentExternalId(courseId: string, assignmentId: string | number) {
  return `${courseId}:${String(assignmentId)}`;
}

function moodleFunction(connection: MoodleConnection, key: keyof MoodleMetadata, fallback: string) {
  return asMetadata(connection)[key] ?? fallback;
}

async function callMoodle<T>(
  connection: MoodleConnection,
  wsfunction: string,
  params: Record<string, unknown>,
): Promise<T> {
  const url = new URL(buildUrl(connection.baseUrl));
  url.searchParams.set("wstoken", connection.accessToken);
  url.searchParams.set("moodlewsrestformat", "json");
  url.searchParams.set("wsfunction", wsfunction);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return await lmsRestGetJson<T>(url.toString(), "");
}

function flattenContents(contents: MoodleCourseContent[]): MoodleCourseContent[] {
  const flat: MoodleCourseContent[] = [];
  for (const item of contents) {
    flat.push(item);
    if (item.modules?.length) flat.push(...flattenContents(item.modules));
    if (item.contents?.length) flat.push(...flattenContents(item.contents));
  }
  return flat;
}

function mapCourse(course: MoodleCourse): LmsCourseRecord {
  return {
    id: entityId("moodle", String(course.id)),
    code: course.shortname ?? null,
    title: course.displayname ?? course.fullname ?? String(course.id),
    term: course.categoryname ?? null,
    updatedAt: course.timemodified ? new Date(course.timemodified * 1000).toISOString() : null,
  };
}

function mapAssignment(courseId: string, item: MoodleCourseContent): LmsAssignmentRecord {
  const assignmentId = String(item.instance ?? item.id ?? item.coursemodule ?? item.name ?? "");
  return {
    id: entityId("moodle", assignmentExternalId(courseId, assignmentId)),
    courseId: entityId("moodle", courseId),
    title: item.name ?? assignmentId,
    dueAt: null,
    availableFrom: null,
    availableUntil: null,
  };
}

function mapSubmission(assignmentExternalIdValue: string, row: MoodleAssignmentSubmission): LmsSubmissionRecord {
  const [courseId, assignmentId] = assignmentExternalIdValue.split(":", 2);
  const studentId = String(row.userid ?? "");
  const submittedAt = row.submission?.timecreated ?? row.submission?.timemodified ?? null;
  return {
    id: entityId("moodle", `${assignmentExternalIdValue}:${studentId}`),
    assignmentId: entityId("moodle", `${courseId}:${assignmentId}`),
    studentId,
    submittedAt: submittedAt ? new Date(submittedAt * 1000).toISOString() : null,
    status: row.status === "submitted" || row.submission?.status === "submitted"
      ? "submitted"
      : row.status === "late" || row.submission?.status === "late"
      ? "late"
      : row.status === "missing" || row.submission?.status === "missing"
      ? "missing"
      : row.status === "excused" || row.submission?.status === "excused"
      ? "excused"
      : "unknown",
    sourceUrl: null,
  };
}

function mapGrade(assignmentExternalIdValue: string, row: MoodleAssignmentSubmission): LmsGradeRecord {
  const [courseId, assignmentId] = assignmentExternalIdValue.split(":", 2);
  const studentId = String(row.userid ?? "");
  const grade = row.grading?.grade ?? row.submission?.grading?.grade ?? null;
  return {
    id: entityId("moodle", `${assignmentExternalIdValue}:${studentId}:grade`),
    submissionId: entityId("moodle", `${courseId}:${assignmentId}:${studentId}`),
    score: typeof grade === "number" ? grade : null,
    gradedAt: row.grading?.timemodified ?? row.submission?.grading?.timemodified
      ? new Date((row.grading?.timemodified ?? row.submission?.grading?.timemodified ?? 0) * 1000).toISOString()
      : null,
  };
}

function mapTimingEvents(assignmentExternalIdValue: string, rows: MoodleAssignmentSubmission[]): LmsTimingEvent[] {
  return rows
    .filter((row) => Boolean(row.submission?.timecreated ?? row.submission?.timemodified))
    .map((row) => {
      const studentId = String(row.userid ?? "");
      const submittedAt = row.submission?.timecreated ?? row.submission?.timemodified ?? 0;
      return {
        id: entityId("moodle", `${assignmentExternalIdValue}:${studentId}:submitted`),
        submissionId: entityId("moodle", `${assignmentExternalIdValue}:${studentId}`),
        eventType: "submitted",
        occurredAt: new Date(submittedAt * 1000).toISOString(),
        source: "moodle",
      } satisfies LmsTimingEvent;
    });
}

function mapEngagementEvents(courseId: string, users: MoodleEnrolledUser[]): LmsEngagementEvent[] {
  return users
    .filter((user) => Boolean(user.lastaccess ?? user.timemodified))
    .map((user) => ({
      id: entityId("moodle", `${courseId}:${user.id}:activity`),
      courseId: entityId("moodle", courseId),
      studentId: String(user.id),
      eventType: "last_activity",
      occurredAt: new Date((user.lastaccess ?? user.timemodified ?? 0) * 1000).toISOString(),
      metadata: {
        full_name: user.fullname ?? null,
        email: user.email ?? null,
      },
    }));
}

async function fetchCourses(connection: MoodleConnection) {
  const functionName = moodleFunction(connection, "coursesFunction", "core_course_get_courses");
  return await callMoodle<MoodleCourse[]>(connection, functionName, {});
}

async function fetchCourseContents(connection: MoodleConnection, courseId: string) {
  const functionName = moodleFunction(connection, "courseContentsFunction", "core_course_get_course_contents");
  return await callMoodle<MoodleCourseContent[]>(connection, functionName, { courseid: Number(courseId) });
}

async function fetchEnrolledUsers(connection: MoodleConnection, courseId: string) {
  const functionName = moodleFunction(connection, "enrolledUsersFunction", "core_enrol_get_enrolled_users");
  return await callMoodle<MoodleEnrolledUser[]>(connection, functionName, { courseid: Number(courseId) });
}

async function fetchAssignmentSubmissions(connection: MoodleConnection, assignmentId: string) {
  const functionName = moodleFunction(connection, "assignmentSubmissionsFunction", "mod_assign_get_submission_status");
  return await callMoodle<MoodleAssignmentSubmission[]>(connection, functionName, { assignid: Number(assignmentId) });
}

async function fetchAssignmentGrades(connection: MoodleConnection, assignmentId: string) {
  const functionName = moodleFunction(connection, "assignmentGradesFunction", "mod_assign_get_submissions");
  return await callMoodle<MoodleAssignmentSubmission[]>(connection, functionName, { assignid: Number(assignmentId) });
}

export function createMoodleProvider(connection: MoodleConnection): LmsProviderAdapter {
  return {
    id: "moodle",
    displayName: "Moodle",
    supportsLtiLaunch: true,
    supportsEvents: true,
    async sync(request: LmsSyncRequest): Promise<LmsSyncResult> {
      const result = summary("moodle");
      const courses = request.courseId
        ? (await fetchCourses(connection)).filter((course) => String(course.id) === request.courseId)
        : await fetchCourses(connection);

      result.summary.coursesSynced = courses.length;

      for (const course of courses) {
        const users = await fetchEnrolledUsers(connection, courseExternalId(course));
        result.summary.eventsSynced += mapEngagementEvents(courseExternalId(course), users).length;

        if (request.syncMode === "events") {
          continue;
        }

        const contents = flattenContents(await fetchCourseContents(connection, courseExternalId(course)));
        const assignments = contents.filter((item) => (item.modname ?? "").toLowerCase() === "assign");
        result.summary.assignmentsSynced += assignments.length;

        for (const assignment of assignments) {
          const assignmentId = String(assignment.instance ?? assignment.id ?? assignment.coursemodule ?? "");
          const submissions = await fetchAssignmentSubmissions(connection, assignmentId);
          const grades = await fetchAssignmentGrades(connection, assignmentId);
          result.summary.submissionsSynced += submissions.length;
          result.summary.gradesSynced += grades.length;
          result.summary.eventsSynced += mapTimingEvents(assignmentExternalId(courseExternalId(course), assignmentId), submissions).length;
        }
      }

      return result;
    },
    async pullCourses() {
      return (await fetchCourses(connection)).map(mapCourse);
    },
    async pullAssignments(courseId: string) {
      const contents = flattenContents(await fetchCourseContents(connection, courseId));
      return contents
        .filter((item) => (item.modname ?? "").toLowerCase() === "assign")
        .map((item) => mapAssignment(courseId, item));
    },
    async pullSubmissions(assignmentId: string) {
      const [courseId, moodleAssignmentId] = assignmentId.split(":", 2);
      return (await fetchAssignmentSubmissions(connection, moodleAssignmentId)).map((row) => mapSubmission(`${courseId}:${moodleAssignmentId}`, row));
    },
    async pullGrades(assignmentId: string) {
      const [courseId, moodleAssignmentId] = assignmentId.split(":", 2);
      return (await fetchAssignmentGrades(connection, moodleAssignmentId)).map((row) => mapGrade(`${courseId}:${moodleAssignmentId}`, row));
    },
    async pullTimingEvents(courseId: string) {
      const contents = flattenContents(await fetchCourseContents(connection, courseId));
      const timingEvents: LmsTimingEvent[] = [];
      for (const assignment of contents.filter((item) => (item.modname ?? "").toLowerCase() === "assign")) {
        const assignmentId = String(assignment.instance ?? assignment.id ?? assignment.coursemodule ?? "");
        const submissions = await fetchAssignmentSubmissions(connection, assignmentId);
        timingEvents.push(...mapTimingEvents(`${courseId}:${assignmentId}`, submissions));
      }
      return timingEvents;
    },
    async pullEngagementEvents(courseId: string) {
      return mapEngagementEvents(courseId, await fetchEnrolledUsers(connection, courseId));
    },
  };
}
