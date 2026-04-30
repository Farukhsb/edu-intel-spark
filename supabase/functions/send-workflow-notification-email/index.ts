import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  createAdminClient,
  jsonError,
  requireUser,
} from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { logWarn } from "../_shared/log.ts";
import {
  formatAssignmentPublishedEmail,
  formatGradeReleasedEmail,
  formatSubmissionNotificationEmail,
  getAppBaseUrl,
  sendEmail,
} from "../_shared/email.ts";
import { applyRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

const RequestSchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("assignment-published"),
    assignmentId: z.string().uuid(),
  }),
  z.object({
    category: z.literal("submission-received"),
    assignmentId: z.string().uuid(),
    submissionId: z.string().uuid(),
  }),
  z.object({
    category: z.literal("grade-released"),
    assignmentId: z.string().uuid(),
    submissionId: z.string().uuid(),
  }),
]);

type AssignmentRow = {
  id: string;
  title: string;
  lecturer_id: string;
  due_date: string | null;
};

type AssignmentCohortRow = {
  cohort_id: string;
};

type AssignmentDepartmentRow = {
  department_id: string;
};

type ProfileRow = {
  id: string;
  department_id?: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  cohort_id?: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
};

type WorkflowNotificationLogInsert = {
  dedupe_key: string;
  notification_type: "assignment-published" | "submission-received" | "grade-released";
  assignment_id: string | null;
  submission_id: string | null;
  recipient_email: string;
  triggered_by: string;
};

const jsonSuccess = (corsHeaders: Record<string, string>, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const buildNotificationDedupeKey = (input: {
  category: "assignment-published" | "submission-received" | "grade-released";
  assignmentId: string;
  submissionId?: string | null;
  recipientEmail: string;
}) => {
  const recipientEmail = normalizeEmail(input.recipientEmail);

  if (input.category === "assignment-published") {
    return `${input.category}:${input.assignmentId}:${recipientEmail}`;
  }

  return `${input.category}:${input.submissionId}:${recipientEmail}`;
};

const reserveWorkflowNotification = async (
  admin: ReturnType<typeof createAdminClient>,
  payload: WorkflowNotificationLogInsert,
) => {
  const { data, error } = await admin
    .from("workflow_notification_log")
    .insert({
      ...payload,
      delivery_status: "pending",
      sent_at: null,
      last_error: null,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return null;
  }

  if (error || !data?.id) {
    throw error ?? new Error("Failed to reserve workflow notification");
  }

  return data.id as string;
};

const markWorkflowNotificationSent = async (
  admin: ReturnType<typeof createAdminClient>,
  notificationId: string,
) => {
  const { error } = await admin
    .from("workflow_notification_log")
    .update({
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", notificationId);

  if (error) throw error;
};

const markWorkflowNotificationFailed = async (
  admin: ReturnType<typeof createAdminClient>,
  notificationId: string,
  errorMessage: string,
) => {
  const { error } = await admin
    .from("workflow_notification_log")
    .update({
      delivery_status: "failed",
      last_error: errorMessage.slice(0, 1000),
    })
    .eq("id", notificationId);

  if (error) throw error;
};

const sendWorkflowEmailWithDedupe = async (
  admin: ReturnType<typeof createAdminClient>,
  payload: WorkflowNotificationLogInsert,
  email: { subject: string; text: string; html: string },
) => {
  const notificationId = await reserveWorkflowNotification(admin, payload);

  if (!notificationId) {
    return { sent: false, duplicate: true };
  }

  try {
    await sendEmail({
      to: payload.recipient_email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    await markWorkflowNotificationSent(admin, notificationId);
    return { sent: true, duplicate: false };
  } catch (error) {
    await markWorkflowNotificationFailed(
      admin,
      notificationId,
      error instanceof Error ? error.message : "Unknown email error",
    );
    throw error;
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user } = await requireUser(req);
    const rateLimit = applyRateLimit(req, {
      scope: "workflow-notification-email",
      limit: 10,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      logWarn("[workflow-email] rate limit exceeded", {
        identifierType: rateLimit.identifierType,
      });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }
    const admin = createAdminClient();
    const rawBody = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assignmentRes = await admin
      .from("assignments")
      .select("id, title, lecturer_id, due_date")
      .eq("id", parsed.data.assignmentId)
      .maybeSingle<AssignmentRow>();

    if (assignmentRes.error || !assignmentRes.data) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assignment = assignmentRes.data;
    const assignmentUrl = `${getAppBaseUrl()}/dashboard/assignments/${encodeURIComponent(assignment.id)}`;

    if (parsed.data.category === "assignment-published") {
      if (assignment.lecturer_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assignmentCohortsRes = await admin
        .from("assignment_cohorts")
        .select("cohort_id")
        .eq("assignment_id", assignment.id);
      const assignmentDepartmentsRes = await admin
        .from("assignment_departments")
        .select("department_id")
        .eq("assignment_id", assignment.id);

      if (assignmentCohortsRes.error || assignmentDepartmentsRes.error) {
        throw assignmentCohortsRes.error ?? assignmentDepartmentsRes.error;
      }

      const cohortIds = Array.from(
        new Set(
          ((assignmentCohortsRes.data || []) as AssignmentCohortRow[])
            .map((row) => row.cohort_id)
            .filter(Boolean),
        ),
      );
      const departmentIds = Array.from(
        new Set(
          ((assignmentDepartmentsRes.data || []) as AssignmentDepartmentRow[])
            .map((row) => row.department_id)
            .filter(Boolean),
        ),
      );

      if (cohortIds.length === 0 && departmentIds.length === 0) {
        logWarn("[workflow-email] assignment-published skipped because no targeting is stored", {
          assignmentId: assignment.id,
        });
        return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "targeting_missing" });
      }

      let studentsQuery = admin
        .from("profiles")
        .select("id, full_name, email, role, cohort_id, department_id")
        .eq("role", "student");

      if (cohortIds.length > 0) {
        studentsQuery = studentsQuery.in("cohort_id", cohortIds);
      }
      if (departmentIds.length > 0) {
        studentsQuery = studentsQuery.in("department_id", departmentIds);
      }

      const studentsRes = await studentsQuery;

      if (studentsRes.error) {
        throw studentsRes.error;
      }

      let sentCount = 0;
      const sentEmails = new Set<string>();

      for (const student of (studentsRes.data || []) as ProfileRow[]) {
        const recipientEmail = normalizeEmail(student.email);
        if (!recipientEmail || sentEmails.has(recipientEmail)) continue;

        sentEmails.add(recipientEmail);
        const email = formatAssignmentPublishedEmail({
          studentName: student.full_name,
          assignmentTitle: assignment.title,
          dueDate: assignment.due_date,
          assignmentUrl,
        });
        const delivery = await sendWorkflowEmailWithDedupe(admin, {
          dedupe_key: buildNotificationDedupeKey({
            category: "assignment-published",
            assignmentId: assignment.id,
            recipientEmail,
          }),
          notification_type: "assignment-published",
          assignment_id: assignment.id,
          submission_id: null,
          recipient_email: recipientEmail,
          triggered_by: user.id,
        }, email);
        if (!delivery.duplicate) {
          sentCount++;
        }
      }

      return jsonSuccess(corsHeaders, { success: true, sentCount });
    }

    if (parsed.data.category === "submission-received") {
      const submissionRes = await admin
        .from("submissions")
        .select("id, assignment_id, student_id, student_name, student_email, submitted_at")
        .eq("id", parsed.data.submissionId)
        .eq("assignment_id", assignment.id)
        .maybeSingle<SubmissionRow>();

      if (submissionRes.error || !submissionRes.data) {
        return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "submission_not_found" });
      }

      const submission = submissionRes.data;
      const isSubmittingStudent =
        submission.student_id === user.id || normalizeEmail(submission.student_email) === normalizeEmail(user.email);

      if (!isSubmittingStudent) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lecturerRes = await admin
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", assignment.lecturer_id)
        .maybeSingle<ProfileRow>();

      if (lecturerRes.error || !lecturerRes.data?.email) {
        return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "recipient_missing" });
      }

      const email = formatSubmissionNotificationEmail({
        lecturerName: lecturerRes.data.full_name,
        assignmentTitle: assignment.title,
        studentName: submission.student_name || submission.student_email || "A student",
        submittedAt: submission.submitted_at,
        reviewUrl: assignmentUrl,
      });

      const recipientEmail = normalizeEmail(lecturerRes.data.email);
      const delivery = await sendWorkflowEmailWithDedupe(admin, {
        dedupe_key: buildNotificationDedupeKey({
          category: "submission-received",
          assignmentId: assignment.id,
          submissionId: submission.id,
          recipientEmail,
        }),
        notification_type: "submission-received",
        assignment_id: assignment.id,
        submission_id: submission.id,
        recipient_email: recipientEmail,
        triggered_by: user.id,
      }, email);

      if (delivery.duplicate) {
        return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "duplicate_notification" });
      }

      return jsonSuccess(corsHeaders, { success: true, sentCount: 1 });
    }

    if (assignment.lecturer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submissionRes = await admin
      .from("submissions")
      .select("id, assignment_id, student_id, student_name, student_email, submitted_at")
      .eq("id", parsed.data.submissionId)
      .eq("assignment_id", assignment.id)
      .maybeSingle<SubmissionRow>();

    if (submissionRes.error || !submissionRes.data) {
      return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "submission_not_found" });
    }

    const submission = submissionRes.data;
    const recipientEmail = normalizeEmail(submission.student_email);

    if (!recipientEmail) {
      return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "recipient_missing" });
    }

    const email = formatGradeReleasedEmail({
      studentName: submission.student_name,
      assignmentTitle: assignment.title,
      assignmentUrl,
    });

    const delivery = await sendWorkflowEmailWithDedupe(admin, {
      dedupe_key: buildNotificationDedupeKey({
        category: "grade-released",
        assignmentId: assignment.id,
        submissionId: submission.id,
        recipientEmail,
      }),
      notification_type: "grade-released",
      assignment_id: assignment.id,
      submission_id: submission.id,
      recipient_email: recipientEmail,
      triggered_by: user.id,
    }, email);

    if (delivery.duplicate) {
      return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "duplicate_notification" });
    }

    return jsonSuccess(corsHeaders, { success: true, sentCount: 1 });
  } catch (error) {
    return jsonError(error, corsHeaders);
  }
});
