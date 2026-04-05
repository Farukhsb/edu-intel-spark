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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

    const submissionList = submissions.map((s: any) => ({
      id: s.id,
      student: s.student_name || s.student_email || "Anonymous",
      file: s.file_name,
      url: s.file_url,
    }));

    const prompt = `You are an academic integrity analyst. Compare these ${submissions.length} student submissions for the same assignment and identify any pairs that show suspicious similarity.

Submissions:
${submissionList.map((s: any, i: number) => `${i + 1}. ${s.student} - ${s.file} (${s.url})`).join("\n")}

Analyze the file names, submission patterns, and any available metadata. Flag pairs that warrant further review.

Respond with a JSON object containing:
- "flags": array of objects with "student_a", "student_b", "submission_a_id", "submission_b_id", "similarity_score" (0-100), "reason", "severity" ("low"|"medium"|"high")
- "summary": overall integrity assessment string

Respond ONLY with the JSON object.`;

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
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text || "";

    let result = { flags: [], summary: "Analysis complete" };
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse plagiarism response:", content);
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
