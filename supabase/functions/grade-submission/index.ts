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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) throw new Error("Assignment not found");

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

Please grade this submission and respond with a JSON object containing:
- "score": numeric score out of ${assignment.max_score}
- "feedback": detailed feedback explaining strengths and weaknesses
- "breakdown": array of objects with "criterion", "score", "max_score", "comment"

Be fair, constructive, and specific in your feedback. Respond ONLY with the JSON object.`;

      try {
        const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            messages: [
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI error for submission", sub.id, aiResponse.status, errText);
          await supabase.from("submissions").update({ status: "submitted" }).eq("id", sub.id);
          results.push({ submissionId: sub.id, error: `AI error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.content?.[0]?.text || "";
        
        let gradeResult;
        try {
          // Extract JSON from the response (handle markdown code blocks)
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          gradeResult = JSON.parse(jsonMatch[1].trim());
        } catch {
          console.error("Failed to parse AI response for", sub.id, content);
          await supabase.from("submissions").update({ status: "submitted" }).eq("id", sub.id);
          results.push({ submissionId: sub.id, error: "Failed to parse AI response" });
          continue;
        }

        await supabase.from("grades").insert({
          submission_id: sub.id,
          ai_score: gradeResult.score,
          ai_feedback: gradeResult.feedback,
          ai_breakdown: gradeResult.breakdown || [],
        });

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
