import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type StudentInput = {
  name: string;
  email: string;
  cohort_id?: string;
  department_id?: string;
};

function generateTemporaryPassword() {
  return `GradeAI_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireLecturer(req);
    const { students } = await req.json();

    if (!Array.isArray(students) || students.length === 0) {
      throw new HttpError(400, "No students provided");
    }

    if (students.length > 200) {
      throw new HttpError(400, "Upload is limited to 200 students per request");
    }

    const supabaseAdmin = createAdminClient();
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

      const password = generateTemporaryPassword();
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          role: "student",
          cohort_id: cohortId,
          department_id: departmentId,
        },
      });

      if (error) {
        results.push({ name, email, success: false, error: error.message });
        continue;
      }

      results.push({ name, email, password, success: true });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("bulk-create-students error:", error);
    return jsonError(error, corsHeaders);
  }
});
