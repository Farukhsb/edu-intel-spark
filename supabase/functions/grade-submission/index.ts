import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submissionIds, assignmentId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch assignment details including rubric
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) throw new Error("Assignment not found");

    // Fetch submissions
    const { data: submissions, error: sErr } = await supabase
      .from("submissions")
      .select("*")
      .in("id", submissionIds);

    if (sErr || !submissions?.length) throw new Error("No submissions found");

    const rubric = assignment.rubric || [];
    const rubricText = Array.isArray(rubric) && rubric.length > 0
      ? rubric.map((r: any) => `- ${r.criterion} (${r.weight} pts): ${r.description || ""}`).join("\n")
      : "No specific rubric provided. Grade holistically based on quality, completeness, and correctness.";

    const results: any[] = [];

    for (const sub of submissions) {
      // Update status to ai_grading
      await supabase
        .from("submissions")
        .update({ status: "ai_grading" })
        .eq("id", sub.id);

      const prompt = `You are an expert academic grader. Grade this student submission for the assignment "${assignment.title}".

Assignment Description: ${assignment.description || "N/A"}
Module: ${assignment.module_code || "N/A"}
Maximum Score: ${assignment.max_score}

Rubric Criteria:
${rubricText}

Student: ${sub.student_name || sub.student_email || "Anonymous"}
File: ${sub.file_name} (${sub.file_type || "unknown type"})
File URL: ${sub.file_url}

Please grade this submission. Provide:
1. A numeric score out of ${assignment.max_score}
2. Detailed feedback explaining strengths and weaknesses
3. A breakdown by rubric criterion (if rubric provided)

Be fair, constructive, and specific in your feedback.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are an expert academic grader. Always respond with valid JSON." },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_grade",
                  description: "Submit the grading result for a student submission",
                  parameters: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: `Score out of ${assignment.max_score}` },
                      feedback: { type: "string", description: "Detailed feedback for the student" },
                      breakdown: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            criterion: { type: "string" },
                            score: { type: "number" },
                            max_score: { type: "number" },
                            comment: { type: "string" },
                          },
                          required: ["criterion", "score", "max_score", "comment"],
                        },
                        description: "Score breakdown by rubric criterion",
                      },
                    },
                    required: ["score", "feedback", "breakdown"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "submit_grade" } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI error for submission", sub.id, aiResponse.status, errText);
          // Mark as submitted again on failure
          await supabase.from("submissions").update({ status: "submitted" }).eq("id", sub.id);
          results.push({ submissionId: sub.id, error: `AI error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        let gradeResult;
        if (toolCall?.function?.arguments) {
          gradeResult = JSON.parse(toolCall.function.arguments);
        } else {
          // Fallback: try to parse from content
          console.error("No tool call in response for", sub.id);
          await supabase.from("submissions").update({ status: "submitted" }).eq("id", sub.id);
          results.push({ submissionId: sub.id, error: "Failed to parse AI response" });
          continue;
        }

        // Insert grade
        await supabase.from("grades").insert({
          submission_id: sub.id,
          ai_score: gradeResult.score,
          ai_feedback: gradeResult.feedback,
          ai_breakdown: gradeResult.breakdown || [],
        });

        // Update submission status
        await supabase.from("submissions").update({ status: "ai_graded" }).eq("id", sub.id);

        results.push({ submissionId: sub.id, score: gradeResult.score, success: true });
      } catch (gradeErr) {
        console.error("Grading error for", sub.id, gradeErr);
        await supabase.from("submissions").update({ status: "submitted" }).eq("id", sub.id);
        results.push({ submissionId: sub.id, error: String(gradeErr) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-submission error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
