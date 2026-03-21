import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assignmentId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: submissions, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("submitted_at");

    if (error || !submissions?.length) {
      return new Response(JSON.stringify({ flags: [], message: "No submissions to compare" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (submissions.length < 2) {
      return new Response(JSON.stringify({ flags: [], message: "Need at least 2 submissions to compare" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build submission summaries for comparison
    const submissionList = submissions.map((s: any) => ({
      id: s.id,
      student: s.student_name || s.student_email || "Anonymous",
      file: s.file_name,
      url: s.file_url,
    }));

    const prompt = `You are an academic integrity analyst. Compare these ${submissions.length} student submissions for the same assignment and identify any pairs that show suspicious similarity.

Submissions:
${submissionList.map((s: any, i: number) => `${i + 1}. ${s.student} - ${s.file} (${s.url})`).join("\n")}

Analyze the file names, submission patterns, and any available metadata. Flag pairs that warrant further review. Consider:
- Similar file names or naming patterns
- Submissions very close in time
- Any other suspicious patterns

For each flagged pair, provide a similarity score (0-100) and explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an academic integrity analyst. Respond with structured data." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_similarity",
              description: "Report similarity findings between submissions",
              parameters: {
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
                        similarity_score: { type: "number", description: "0-100 similarity percentage" },
                        reason: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["student_a", "student_b", "similarity_score", "reason", "severity"],
                    },
                  },
                  summary: { type: "string", description: "Overall integrity assessment" },
                },
                required: ["flags", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_similarity" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let result = { flags: [], summary: "Analysis complete" };
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-plagiarism error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
