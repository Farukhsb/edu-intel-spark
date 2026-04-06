import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
      console.log(`Processing submission ${sub.id} - ${sub.file_name}`);

      // Fetch the actual file content from the URL
      let fileContent = "";
      let isPdf = false;
      try {
        const fileResp = await fetch(sub.file_url);
        if (!fileResp.ok) {
          console.error(`Failed to fetch file for ${sub.id}: ${fileResp.status}`);
          results.push({ submissionId: sub.id, error: `Failed to download file: ${fileResp.status}` });
          continue;
        }
        const contentType = fileResp.headers.get("content-type") || "";
        isPdf = contentType.includes("pdf") || sub.file_name?.toLowerCase().endsWith(".pdf");
        
        if (isPdf) {
          // For PDFs, convert to base64 for the AI to read
          const arrayBuf = await fileResp.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          // Convert to base64
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          fileContent = btoa(binary);
        } else {
          fileContent = await fileResp.text();
        }
        console.log(`File fetched for ${sub.id}, size: ${fileContent.length}, isPdf: ${isPdf}`);
      } catch (fetchErr) {
        console.error(`Error fetching file for ${sub.id}:`, fetchErr);
        results.push({ submissionId: sub.id, error: `Failed to fetch file: ${String(fetchErr)}` });
        continue;
      }

      const systemPrompt = `You are an expert academic grader. Grade student submissions fairly, constructively, and specifically. Always respond with valid JSON only.`;

      const prompt = `Grade this student submission for the assignment "${assignment.title}".

Assignment Description: ${assignment.description || "N/A"}
Module: ${assignment.module_code || "N/A"}
Maximum Score: ${assignment.max_score}

Rubric Criteria:
${rubricText}

Student: ${sub.student_name || "Anonymous"}
File: ${sub.file_name}

${isPdf ? "The student's PDF submission content is attached as an inline document below." : `Student's submission content:\n\n${fileContent.substring(0, 15000)}`}

Grade this submission carefully.`;

      // Build messages - use multimodal for PDFs
      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      if (isPdf) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${fileContent}`,
              },
            },
          ],
        });
      } else {
        messages.push({ role: "user", content: prompt });
      }

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages,
            tools: [
              {
                type: "function",
                function: {
                  name: "submit_grade",
                  description: "Submit the grading result for a student submission",
                  parameters: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: `Numeric score out of ${assignment.max_score}` },
                      feedback: { type: "string", description: "Detailed feedback explaining strengths and weaknesses" },
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
                      },
                    },
                    required: ["score", "feedback", "breakdown"],
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
          results.push({ submissionId: sub.id, error: `AI error: ${aiResponse.status} - ${errText.substring(0, 200)}` });
          continue;
        }

        const aiData = await aiResponse.json();
        console.log(`AI response received for ${sub.id}`);

        let gradeResult;
        try {
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            gradeResult = JSON.parse(toolCall.function.arguments);
          } else {
            // Fallback: try parsing content directly
            const content = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
            gradeResult = JSON.parse(jsonMatch[1].trim());
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response for", sub.id, JSON.stringify(aiData).substring(0, 500));
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
