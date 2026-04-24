import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";

type StudentInput = {
  name: string;
  email: string;
  studentId?: string;
  cohort_id?: string;
  department_id?: string;
};

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

function generateTemporaryPassword() {
  return `GradeAI_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireLecturer(req);
    const body = await req.json().catch(() => null);
    const parsed = BulkCreateStudentsRequestSchema.safeParse(body);

    if (!parsed.success) {
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
