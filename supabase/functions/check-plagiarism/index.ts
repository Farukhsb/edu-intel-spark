import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchFileContent(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  sub: { file_url?: string; file_name?: string },
): Promise<string> {
  if (!sub.file_url) return "";
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("submissions")
      .download(sub.file_url);
    if (error || !data) return "";
    
    const isPdf = data.type?.includes("pdf") || sub.file_name?.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const buf = await data.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    return await data.text();
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const integrityModel = getModel("OPENAI_INTEGRITY_MODEL", "gpt-5.4-mini");
    const { user } = await requireLecturer(req);
    const requestedAssignmentId = body?.assignmentId ?? null;
    const requestedSubmissionIds = Array.isArray(body?.submissionIds)
      ? body.submissionIds
      : Array.isArray(body?.submissions)
        ? body.submissions
            .map((submission: { id?: string } | string) =>
              typeof submission === "string" ? submission : submission?.id,
            )
            .filter(Boolean)
        : [];

    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      return new Response(JSON.stringify({ flags: [], summary: "No submissions provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createAdminClient();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, lecturer_id")
      .eq("id", requestedAssignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error("Failed to load assignment");
    if (!assignment || assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, student_name, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) throw new Error("Failed to load submissions");
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }

    const isSingleMode = submissions.length === 1;

    // Fetch file content for AI analysis
    const fileContents: string[] = [];
    for (const sub of submissions) {
      const content = await fetchFileContent(supabaseAdmin, sub);
      fileContents.push(content);
      console.log(`Fetched file for ${sub.student_name}: ${content.length} chars`);
    }

    const systemPrompt = isSingleMode
      ? "You are an academic integrity expert specializing in detecting AI-generated content. Analyze student submissions for signs of AI generation, including: overly uniform structure, lack of personal voice, unusually consistent quality, generic examples, formulaic transitions, and perfect grammar without natural variation."
      : "You are an academic integrity analyst. Compare student submissions for suspicious similarity and also check each for AI-generated content patterns.";

    let userPrompt: string;
    const userContent: Array<Record<string, string>> = [];

    if (isSingleMode) {
      const sub = submissions[0];
      const isPdf = sub.file_name?.toLowerCase().endsWith(".pdf");
      const content = fileContents[0];

      userPrompt = `Analyze this student submission for signs of AI-generated content:

Student: ${sub.student_name || "Anonymous"}
File: ${sub.file_name}

${!isPdf ? `Content:\n${content.substring(0, 15000)}` : "The PDF document is attached."}

Check for:
1. AI-generated writing patterns (ChatGPT, Claude, etc.)
2. Unusual structural uniformity
3. Lack of personal voice or original thinking
4. Generic or templated examples
5. Inconsistent depth (some sections very detailed, others shallow)
6. Perfect grammar without natural student writing patterns

Provide your analysis.`;

      if (isPdf && content) {
        userContent.push({ type: "input_text", text: `${userPrompt}\n\nReturn valid JSON only.` });
        userContent.push({
          type: "input_file",
          filename: sub.file_name || "submission.pdf",
          file_data: `data:application/pdf;base64,${content}`,
        });
      } else {
        userContent.push({ type: "input_text", text: `${userPrompt}\n\nReturn valid JSON only.` });
      }
    } else {
      userPrompt = `Analyze these ${submissions.length} student submissions for the same assignment. Check for similarity between submissions AND for AI-generated content in each.

Submissions:
${submissions.map((s: { student_name: string | null; file_name: string }, i: number) => {
  const content = fileContents[i] || "";
  const excerpt = content ? content.substring(0, 5000) : "[content unavailable]";
  return `${i + 1}. ${s.student_name} - ${s.file_name}\nContent excerpt:\n${excerpt}`;
}).join("\n\n---\n\n")}

Analyze the content for suspicious similarity and AI-generation patterns.`;
      userContent.push({ type: "input_text", text: `${userPrompt}\n\nReturn valid JSON only.` });
    }

    const aiData = await createResponse({
      model: integrityModel,
      input: [
        { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "report_integrity_results",
          schema: {
            type: "object",
            properties: {
              flags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    student_a: { type: "string" },
                    student_b: { type: "string" },
                    submission_a_id: { type: "string" },
                    submission_b_id: { type: "string" },
                    similarity_score: { type: "number" },
                    reason: { type: "string" },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["student_a", "student_b", "submission_a_id", "submission_b_id", "similarity_score", "reason", "severity"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["flags", "summary"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });
    console.log("AI integrity response received");

    let result = { flags: [], summary: "Analysis complete" };
    try {
      result = parseJsonText(extractOutputText(aiData));
    } catch (parseErr) {
      console.error("Failed to parse integrity response");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-plagiarism error:", e);
    return jsonError(e, corsHeaders);
  }
});
