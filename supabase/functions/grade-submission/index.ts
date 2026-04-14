import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RubricCriterion = {
  criterion: string;
  weight: number;
  description?: string;
};

type GradeBreakdownItem = {
  criterion: string;
  score: number;
  max_score: number;
  comment: string;
};

function clampScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(maxScore, Number(numeric.toFixed(2))));
}

function normalizeBreakdown(raw: unknown, rubric: RubricCriterion[]) {
  const provided = Array.isArray(raw) ? raw : [];
  const byCriterion = new Map(
    provided
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const breakdown = item as Record<string, unknown>;
        const criterion = typeof breakdown.criterion === "string" ? breakdown.criterion.trim() : "";
        return [criterion.toLowerCase(), breakdown] as const;
      }),
  );

  const breakdown: GradeBreakdownItem[] = rubric.map((criterion) => {
    const matched = byCriterion.get(criterion.criterion.toLowerCase());
    const maxScore = criterion.weight;
    const score = clampScore(matched?.score, maxScore);
    const comment =
      typeof matched?.comment === "string" && matched.comment.trim()
        ? matched.comment.trim()
        : "No criterion-specific comment provided.";

    return {
      criterion: criterion.criterion,
      score,
      max_score: maxScore,
      comment,
    };
  });

  const total = Number(
    breakdown.reduce((sum, item) => sum + item.score, 0).toFixed(2),
  );

  return { breakdown, total };
}

function normalizeOverallScore(value: unknown, maxScore: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampScore(numeric, maxScore);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const gradingModel = getModel("OPENAI_GRADING_MODEL", "gpt-5.4-mini");

    const { user } = await requireLecturer(req);
    const requestedAssignmentId = body?.assignmentId ?? body?.assignment?.id ?? null;
    const requestedSubmissionIds = Array.isArray(body?.submissions)
      ? body.submissions
          .map((submission: { id?: string } | string) =>
            typeof submission === "string" ? submission : submission?.id,
          )
          .filter(Boolean)
      : [];

    if (!requestedAssignmentId || requestedSubmissionIds.length === 0) {
      throw new HttpError(400, "Missing assignment or submissions data");
    }

    const supabaseAdmin = createAdminClient();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, lecturer_id, title, description, module_code, max_score, rubric")
      .eq("id", requestedAssignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error("Failed to load assignment");
    if (!assignment || assignment.lecturer_id !== user.id) {
      throw new HttpError(403, "You do not have access to this assignment");
    }

    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, student_name, student_email, file_name, file_url")
      .eq("assignment_id", requestedAssignmentId)
      .in("id", requestedSubmissionIds);

    if (submissionsError) throw new Error("Failed to load submissions");
    if (!submissions || submissions.length !== requestedSubmissionIds.length) {
      throw new HttpError(403, "One or more submissions are not accessible");
    }

    const rubric = Array.isArray(assignment.rubric) ? (assignment.rubric as RubricCriterion[]) : [];
    const normalizedRubric: RubricCriterion[] =
      rubric.length > 0
        ? rubric.map((criterion, index) => ({
            criterion: criterion.criterion || `Criterion ${index + 1}`,
            weight: Number(criterion.weight) || 0,
            description: criterion.description || "",
          }))
        : [
            {
              criterion: "Overall quality",
              weight: assignment.max_score,
              description: "Holistic quality, correctness, and completeness.",
            },
          ];

    const rubricText = normalizedRubric.length > 0
      ? normalizedRubric
          .map((r: { criterion?: string; weight?: number; description?: string }) =>
            `- ${r.criterion || "Criterion"} (${r.weight || 0} pts): ${r.description || ""}`,
          )
          .join("\n")
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
      } catch (fetchErr: unknown) {
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

RUBRIC DISCIPLINE:
- You must return exactly one breakdown row for each rubric criterion supplied.
- Do not invent, merge, or omit criteria.
- Each breakdown score must be between 0 and that criterion's max_score.
- The sum of the criterion scores must equal the final score.

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

Grade this submission carefully against the rubric only. Return exactly ${normalizedRubric.length} breakdown entries matching the rubric criteria in order.`;

      try {
        const responseInput = [
          { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
          {
            role: "user",
            content: isPdf
              ? [
                  { type: "input_text", text: `${prompt}\n\nReturn valid JSON only.` },
                  {
                    type: "input_file",
                    filename: sub.file_name || "submission.pdf",
                    file_data: `data:application/pdf;base64,${fileContent}`,
                  },
                ]
              : [
                  {
                    type: "input_text",
                    text: `${prompt}\n\nStudent submission content:\n\n${fileContent.substring(0, 15000)}\n\nReturn valid JSON only.`,
                  },
                ],
          },
        ];

        const aiData = await createResponse({
          model: gradingModel,
          input: responseInput,
          text: {
            format: {
              type: "json_schema",
              name: "submit_grade",
              schema: {
                type: "object",
                properties: {
                  score: { type: "number", description: `Numeric score out of ${assignment.max_score}` },
                  feedback: { type: "string", description: "Detailed feedback explaining strengths and weaknesses" },
                  breakdown: {
                    type: "array",
                    minItems: normalizedRubric.length,
                    maxItems: normalizedRubric.length,
                    items: {
                      type: "object",
                      properties: {
                        criterion: { type: "string" },
                        score: { type: "number" },
                        max_score: { type: "number" },
                        comment: { type: "string" },
                      },
                      required: ["criterion", "score", "max_score", "comment"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["score", "feedback", "breakdown"],
                additionalProperties: false,
              },
              strict: true,
            },
          },
        });
        console.log(`AI response received for ${sub.id}`);

        let gradeResult;
        try {
          gradeResult = parseJsonText(extractOutputText(aiData));
        } catch {
          gradeResult = aiData?.output?.[0]?.content?.[0]?.json ?? aiData?.output_parsed;
        }

        if (!gradeResult) {
          throw new Error("Failed to parse AI response");
        }

        const normalized = normalizeBreakdown(gradeResult.breakdown, normalizedRubric);
        const modelScore = normalizeOverallScore(gradeResult.score, assignment.max_score);
        const scoreAdjusted = modelScore != null && Math.abs(modelScore - normalized.total) > 1;
        const feedbackBase =
          typeof gradeResult.feedback === "string" && gradeResult.feedback.trim()
            ? gradeResult.feedback.trim()
            : "No detailed feedback was returned.";
        const feedback = scoreAdjusted
          ? `${feedbackBase}\n\nNote: the final score was normalised to match the rubric breakdown total.`
          : feedbackBase;

        results.push({
          submissionId: sub.id,
          score: normalized.total,
          feedback,
          breakdown: normalized.breakdown,
          rubricValidated: true,
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
    return jsonError(e, corsHeaders);
  }
});
