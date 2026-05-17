import { z } from "https://esm.sh/zod@3.23.8";
import { createAdminClient, jsonError, requireAdmin, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { logError, logInfo, logWarn } from "../_shared/log.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

type StudentInput = {
  name: string;
  email: string;
  studentId?: string;
  cohort_id?: string;
  department_name?: string;
  department_id?: string;
};

type ProfileVerification = {
  email: string;
  full_name: string | null;
  cohort_id: string | null;
  department_name: string | null;
  department_id: string | null;
  must_change_password: boolean;
};

const resolveDepartmentName = (input: {
  department_name?: string | null;
  department_id?: string | null;
}) => input.department_name?.trim() || input.department_id?.trim() || null;

const buildDepartmentColumns = (departmentName: string | null) => ({
  department_name: departmentName,
  department_id: departmentName,
});

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function getPasswordSetupRedirectUrl() {
  const configuredAppUrl =
    Deno.env.get("APP_URL")?.trim() ||
    Deno.env.get("SITE_URL")?.trim() ||
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("APP_BASE_URL")?.trim() ||
    "";

  if (!configuredAppUrl) {
    return undefined;
  }

  return `${trimTrailingSlash(configuredAppUrl)}/reset-password`;
}

const PROFILE_FLAG_RETRY_COUNT = 5;
const PROFILE_FLAG_RETRY_DELAY_MS = 400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function markPasswordChangeRequired(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  options: { userId?: string; email: string },
) {
  for (let attempt = 0; attempt < PROFILE_FLAG_RETRY_COUNT; attempt++) {
    let query = supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true });

    if (options.userId) {
      query = query.eq("id", options.userId);
    } else {
      query = query.eq("email", options.email).eq("role", "student");
    }

    const { data, error } = await query.select("id").maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return;
    }

    if (attempt < PROFILE_FLAG_RETRY_COUNT - 1) {
      await wait(PROFILE_FLAG_RETRY_DELAY_MS);
    }
  }

  throw new Error("The student account was invited, but the password-change requirement could not be applied.");
}

async function fetchVerifiedProfile(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  options: { userId?: string; email: string },
) {
  let lastProfile: ProfileVerification | null = null;

  for (let attempt = 0; attempt < PROFILE_FLAG_RETRY_COUNT; attempt++) {
    let query = supabaseAdmin
      .from("profiles")
      .select("email, full_name, cohort_id, department_name, department_id, must_change_password");

    if (options.userId) {
      query = query.eq("id", options.userId);
    } else {
      query = query.eq("email", options.email).eq("role", "student");
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      lastProfile = data as ProfileVerification;
      if (data.must_change_password) {
        return lastProfile;
      }
    }

    if (attempt < PROFILE_FLAG_RETRY_COUNT - 1) {
      await wait(PROFILE_FLAG_RETRY_DELAY_MS);
    }
  }

  return lastProfile;
}

const StudentInputSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  studentId: z.string().trim().min(1).optional(),
  cohort_id: z.string().trim().min(1),
  department_name: z.string().trim().min(1).optional(),
  department_id: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.department_name || value.department_id), {
  message: "Missing department",
  path: ["department_name"],
});

const BulkCreateStudentsRequestSchema = z.object({
  assignmentId: z.string().trim().min(1).optional(),
  cohort: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  students: z.array(StudentInputSchema).min(1).max(500),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const methodError = requirePostMethod(req, corsHeaders);
  if (methodError) return methodError;

  try {
    const { user } = await requireAdmin(req);
    const supabaseAdmin = createAdminClient();
    const rateLimit = await applySharedRateLimit(supabaseAdmin, req, {
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

    const passwordSetupRedirectTo = getPasswordSetupRedirectUrl();
    const results = [];

    for (const student of students as StudentInput[]) {
      const name = student?.name?.trim();
      const email = student?.email?.trim().toLowerCase();
      const cohortId = student?.cohort_id?.trim();
      const departmentName = resolveDepartmentName(student);

      if (!name || !email || !email.includes("@") || !cohortId || !departmentName) {
        results.push({
          name: student?.name ?? "",
          email: student?.email ?? "",
          success: false,
          error: "Missing or invalid required fields (name, email, cohort, department)",
        });
        continue;
      }

      const { data: inviteData, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: name,
          role: "student",
          cohort_id: cohortId,
          ...buildDepartmentColumns(departmentName),
        },
        redirectTo: passwordSetupRedirectTo,
      });

      if (error) {
        results.push({ name, email, success: false, error: error.message });
        continue;
      }

      try {
        await markPasswordChangeRequired(supabaseAdmin, {
          userId: inviteData.user?.id,
          email,
        });

        const verifiedProfile = await fetchVerifiedProfile(supabaseAdmin, {
          userId: inviteData.user?.id,
          email,
        });

        results.push({
          name,
          email,
          success: true,
          invite_sent: true,
          verified_profile: verifiedProfile,
        });
      } catch (flagError) {
        logError("Failed to mark invited student for password change", flagError, {
          function: "bulk-create-students",
          email,
          userId: inviteData.user?.id ?? null,
        });
        results.push({
          name,
          email,
          success: false,
          error: flagError instanceof Error ? flagError.message : "Password-change requirement could not be applied",
        });
        continue;
      }
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
