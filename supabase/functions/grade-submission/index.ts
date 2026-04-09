import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Create admin client to access private storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rubric = assignment.rubric || [];
    const rubricText = Array.isArray(rubric) && rubric.length > 0
      ? rubric.map((r: any) => `- ${r.criterion} (${r.weight} pts): ${r.description || ""}`).join("\n")
      : "No specific rubric provided. Grade holistically based on quality, completeness, and correctness.";

    const results: any[] = [];

    for (const sub of submissions) {
      console.log(`Processing submission ${sub.id} - ${sub.file_name}`);

      let fileContent = "";
      let isPdf = false;
      try {
        // Download from private storage using admin client
        const storagePath = sub.file_url;
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from("submissions")
          .download(storagePath);
        
        if (dlError || !fileData) {
          console.error(`Failed to download file for ${sub.id}:`, dlError);
          results.push({ submissionId: sub.id, error: `Failed to download file` });
          continue;
        }

        isPdf = sub.file_name?.toLowerCase().endsWith(".pdf") || fileData.type?.includes("pdf");

        if (isPdf) {
          const arrayBuf = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          fileContent = btoa(binary);
        } else {
          fileContent = await fileData.text();
        }
        console.log(`File fetched for ${sub.id}, size: ${fileContent.length}, isPdf: ${isPdf}`);
      } catch (fetchErr) {
        console.error(`Error fetching file for ${sub.id}:`, fetchErr);
        results.push({ submissionId: sub.id, error: `Failed to fetch file: ${String(fetchErr)}` });
        continue;
      }

      const systemPrompt = `You are an experienced, fair-minded university lecturer marking student submissions.

Your marking philosophy mirrors real academic practice — you reward understanding,
apply partial credit generously, and do not penalise heavily for presentational issues.

## CORE MARKING PHILOSOPHY

1. REWARD UNDERSTANDING FIRST
   - If a student demonstrates they understand the concept, award marks for that
   - Correct understanding expressed simply is worth more than perfect formatting
   - Grade what students KNOW, not how perfectly they expressed it

2. PARTIAL CREDIT IS THE DEFAULT
   - A basic mention of a relevant concept = 40–50% of that criterion's marks
   - A moderate but incomplete explanation = 55–70% of that criterion's marks
   - A clear, correct explanation = 75–90% of that criterion's marks
   - A thorough, well-evidenced explanation = 90–100% of that criterion's marks
   - NEVER award 0 for a criterion unless the answer is completely irrelevant or blank

3. FORMATTING IS SECONDARY
   - Missing diagrams: deduct max 5% of the criterion weight, not more
   - Missing references: deduct max 5–8% overall
   - Poor structure: deduct max 5%
   - These should NEVER be the primary reason for a low score

4. CALIBRATION BANDS — YOU MUST STAY WITHIN THESE
   - Strong answer (addresses question well, correct understanding): 75–90+
   - Competent answer (addresses most parts, mostly correct): 60–75
   - Partial answer (addresses some parts, some understanding shown): 45–60
   - Weak but relevant answer (minimal correct content): 35–45
   - Irrelevant or blank: below 35
   
   ⚠️ If a student addresses the main question and shows understanding, 
   the MINIMUM overall score is 55. Do not go below this unless content 
   is largely incorrect or irrelevant.

5. SEMANTIC UNDERSTANDING
   - Mark based on MEANING, not exact keywords
   - A student saying "data moves between computers" is demonstrating 
     understanding of networking — award marks accordingly
   - Simple phrasing ≠ wrong answer

## RUBRIC APPLICATION RULES
For each rubric criterion provided:
- Ask yourself: "Did this student show they understand this concept?"
- If YES fully → 80–100% of criterion marks
- If YES partially → 50–79% of criterion marks
- If MINIMALLY → 30–49% of criterion marks
- If NOT AT ALL → 0–29% of criterion marks

Weight criteria exactly as provided, but apply them generously within the band above.

## LETTER GRADE MAPPING
- 70%+ → 1st
- 60–69% → 2:1
- 50–59% → 2:2
- 40–49% → 3rd
- Below 40% → Fail

## FINAL CHECK — BEFORE RETURNING YOUR RESPONSE
Ask yourself:
1. Did I reward what the student got RIGHT, not just penalise what they got wrong?
2. Is my score consistent with a fair human lecturer at a real university?
3. Did I apply partial credit for every relevant attempt, even if imperfect?
4. Are formatting penalties minor and proportionate?
5. If the student addressed the main question — is my score at least 55?

If any answer is NO, revise your scores upward before responding.

Always respond with valid JSON only.`;

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
          results.push({ submissionId: sub.id, error: `AI error: ${aiResponse.status}` });
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
            const content = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
            gradeResult = JSON.parse(jsonMatch[1].trim());
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response for", sub.id);
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
