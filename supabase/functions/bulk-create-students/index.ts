import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createAdminClient, jsonError, requireAdmin, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applyRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

type StudentInput = {
  name: string;
  email: string;
  studentId?: string;
  cohort_id?: string;
  department_id?: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function getPasswordSetupRedirectUrl() {
  const configuredAppUrl =
    Deno.env.get("APP_URL")?.trim() ||
    Deno.env.get("SITE_URL")?.trim() ||
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    "";

  if (!configuredAppUrl) {
    return undefined;
  }

  return `${trimTrailingSlash(configuredAppUrl)}/reset-password`;
}

const StudentInputSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  studentId: z.string().trim().min(1).optional(),
  cohort_id: z.string().trim().min(1),
  department_id: z.string().trim().min(1),
});

const BulkCreateStudentsRequestSchema = z.object({
  assignmentId: z.string().trim().min(1).optional(),
  cohort: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  students: z.array(StudentInputSchema).min(1).max(500),
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const methodError = requirePostMethod(req, corsHeaders);
  if (methodError) return methodError;

  try {
    const { user } = await requireAdmin(req);
    const rateLimit = applyRateLimit(req, {
      scope: "bulk-create-students",
      limit: 20,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "bulk-create-students", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }

    const body = await req.json().catch(() => null);
    const parsed = BulkCreateStudentsRequestSchema.safeParse(body);

    if (!parsed.success) {
      logWarn("Invalid bulk student upload request", {
        function: "bulk-create-students",
        issueCount: parsed.error.issues.length,
      });
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { students } = parsed.data;

    if (students.length > 200) {
      throw new HttpError(400, "Upload is limited to 200 students per request");
    }

    const supabaseAdmin = createAdminClient();
    const passwordSetupRedirectTo = getPasswordSetupRedirectUrl();
    const results = [];

    for (const student of students as StudentInput[]) {
      const name = student?.name?.trim();
      const email = student?.email?.trim().toLowerCase();
      const cohortId = student?.cohort_id?.trim();
      const departmentId = student?.department_id?.trim();

      if (!name || !email || !email.includes("@") || !cohortId || !departmentId) {
        results.push({
          name: student?.name ?? "",
          email: student?.email ?? "",
          success: false,
          error: "Missing or invalid required fields (name, email, cohort, department)",
        });
        continue;
      }

      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: name,
          role: "student",
          cohort_id: cohortId,
          department_id: departmentId,
        },
        redirectTo: passwordSetupRedirectTo,
      });

      if (error) {
        results.push({ name, email, success: false, error: error.message });
        continue;
      }

      results.push({ name, email, success: true, invite_sent: true });
    }

    const successCount = results.filter((result) => result.success).length;
    logInfo("bulk-create-students completed", {
      function: "bulk-create-students",
      requestedCount: students.length,
      successCount,
      failedCount: results.length - successCount,
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("bulk-create-students error", error);
    return jsonError(error, corsHeaders);
  }
});
