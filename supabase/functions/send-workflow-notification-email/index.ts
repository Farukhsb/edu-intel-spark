import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  createAdminClient,
  jsonError,
  requireUser,
} from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import {
  formatAssignmentPublishedEmail,
  formatGradeReleasedEmail,
  formatSubmissionNotificationEmail,
  getAppBaseUrl,
  sendEmail,
} from "../_shared/email.ts";

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

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
};

const jsonSuccess = (corsHeaders: Record<string, string>, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user } = await requireUser(req);
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

      console.warn("[workflow-email] assignment-published is using broad student broadcast fallback", {
        assignmentId: assignment.id,
        targetingMode: "all_students_fallback",
      });

      const studentsRes = await admin
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "student");

      if (studentsRes.error) {
        throw studentsRes.error;
      }

      let sentCount = 0;
      const sentEmails = new Set<string>();

      for (const student of (studentsRes.data || []) as ProfileRow[]) {
        const recipientEmail = student.email?.trim().toLowerCase();
        if (!recipientEmail || sentEmails.has(recipientEmail)) continue;

        sentEmails.add(recipientEmail);
        const email = formatAssignmentPublishedEmail({
          studentName: student.full_name,
          assignmentTitle: assignment.title,
          dueDate: assignment.due_date,
          assignmentUrl,
        });
        await sendEmail({
          to: recipientEmail,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        sentCount++;
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
        submission.student_id === user.id || submission.student_email?.toLowerCase() === user.email?.toLowerCase();

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

      await sendEmail({
        to: lecturerRes.data.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

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
    const recipientEmail = submission.student_email?.trim().toLowerCase();

    if (!recipientEmail) {
      return jsonSuccess(corsHeaders, { success: true, skipped: true, reason: "recipient_missing" });
    }

    const email = formatGradeReleasedEmail({
      studentName: submission.student_name,
      assignmentTitle: assignment.title,
      assignmentUrl,
    });

    await sendEmail({
      to: recipientEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    return jsonSuccess(corsHeaders, { success: true, sentCount: 1 });
  } catch (error) {
    return jsonError(error, corsHeaders);
  }
});
