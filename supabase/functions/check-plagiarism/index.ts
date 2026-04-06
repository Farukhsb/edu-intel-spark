import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

async function fetchFileContent(sub: any): Promise<string> {
  if (!sub.file_url) return "";
  try {
    const resp = await fetch(sub.file_url);
    if (!resp.ok) return "";
    const contentType = resp.headers.get("content-type") || "";
    const isPdf = contentType.includes("pdf") || sub.file_name?.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    return await resp.text();
  } catch {
    return "";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submissions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    if (!submissions?.length) {
      return new Response(JSON.stringify({ flags: [], summary: "No submissions provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSingleMode = submissions.length === 1;

    // Fetch file content for AI analysis
    const fileContents: string[] = [];
    for (const sub of submissions) {
      const content = await fetchFileContent(sub);
      fileContents.push(content);
      console.log(`Fetched file for ${sub.student_name}: ${content.length} chars`);
    }

    const systemPrompt = isSingleMode
      ? "You are an academic integrity expert specializing in detecting AI-generated content. Analyze student submissions for signs of AI generation, including: overly uniform structure, lack of personal voice, unusually consistent quality, generic examples, formulaic transitions, and perfect grammar without natural variation."
      : "You are an academic integrity analyst. Compare student submissions for suspicious similarity and also check each for AI-generated content patterns.";

    let userPrompt: string;
    const messages: any[] = [{ role: "system", content: systemPrompt }];

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
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${content}` } },
          ],
        });
      } else {
        messages.push({ role: "user", content: userPrompt });
      }
    } else {
      userPrompt = `Analyze these ${submissions.length} student submissions for the same assignment. Check for similarity between submissions AND for AI-generated content in each.

Submissions:
${submissions.map((s: any, i: number) => `${i + 1}. ${s.student_name} - ${s.file_name}`).join("\n")}

Analyze the content for suspicious similarity and AI-generation patterns.`;
      messages.push({ role: "user", content: userPrompt });
    }

    // Use tool calling for structured output
    const tools = [
      {
        type: "function",
        function: {
          name: "report_integrity_results",
          description: "Report the academic integrity analysis results",
          parameters: {
            type: "object",
            properties: {
              flags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    student_a: { type: "string", description: "Name of first student (or only student for AI detection)" },
                    student_b: { type: "string", description: "Name of second student, or 'AI Content' for AI detection flags" },
                    submission_a_id: { type: "string" },
                    submission_b_id: { type: "string", description: "Use 'ai-detection' for AI content flags" },
                    similarity_score: { type: "number", description: "Confidence 0-100 that this is plagiarized or AI-generated" },
                    reason: { type: "string", description: "Detailed explanation of why this was flagged" },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["student_a", "student_b", "submission_a_id", "submission_b_id", "similarity_score", "reason", "severity"],
                },
              },
              summary: { type: "string", description: "Overall integrity assessment" },
            },
            required: ["flags", "summary"],
          },
        },
      },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "report_integrity_results" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI integrity response received");

    let result = { flags: [], summary: "Analysis complete" };
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        result = JSON.parse(jsonMatch[1].trim());
      }
    } catch (parseErr) {
      console.error("Failed to parse integrity response:", JSON.stringify(aiData).substring(0, 500));
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
