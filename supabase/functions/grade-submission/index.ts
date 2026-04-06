import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assignment, submissions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!assignment || !submissions?.length) throw new Error("Missing assignment or submissions data");

    const rubric = assignment.rubric || [];
    const rubricText = Array.isArray(rubric) && rubric.length > 0
      ? rubric.map((r: any) => `- ${r.criterion} (${r.weight} pts): ${r.description || ""}`).join("\n")
      : "No specific rubric provided. Grade holistically based on quality, completeness, and correctness.";

    const results: any[] = [];

    for (const sub of submissions) {
      const prompt = `You are an expert academic grader. Grade this student submission for the assignment "${assignment.title}".

Assignment Description: ${assignment.description || "N/A"}
Module: ${assignment.module_code || "N/A"}
Maximum Score: ${assignment.max_score}

Rubric Criteria:
${rubricText}

Student: ${sub.student_name || "Anonymous"}
File: ${sub.file_name} (${sub.file_type || "unknown type"})
File URL: ${sub.file_url}

Please grade this submission and respond with a JSON object containing:
- "score": numeric score out of ${assignment.max_score}
- "feedback": detailed feedback explaining strengths and weaknesses
- "breakdown": array of objects with "criterion", "score", "max_score", "comment"

Be fair, constructive, and specific in your feedback. Respond ONLY with the JSON object.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI error for submission", sub.id, aiResponse.status, errText);
          results.push({ submissionId: sub.id, error: `AI error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        let gradeResult;
        try {
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          gradeResult = JSON.parse(jsonMatch[1].trim());
        } catch {
          console.error("Failed to parse AI response for", sub.id, content);
          results.push({ submissionId: sub.id, error: "Failed to parse AI response" });
          continue;
        }

        results.push({
          submissionId: sub.id,
          score: gradeResult.score,
          feedback: gradeResult.feedback,
          breakdown: gradeResult.breakdown || [],
          success: true,
        });
      } catch (gradeErr) {
        console.error("Grading error for", sub.id, gradeErr);
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
