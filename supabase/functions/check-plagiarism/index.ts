import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer, HttpError } from "../_shared/auth.ts";
import { createResponse, extractOutputText, getModel, parseJsonText } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IntegrityFlag = {
  student_a: string;
  student_b: string;
  submission_a_id: string;
  submission_b_id: string;
  similarity_score: number;
  ai_suspicion_score: number;
  reason: string;
  evidence_summary: string;
  matched_excerpt: string;
  recommended_action: "clear" | "review" | "investigate";
  integrity_type: "similarity" | "ai-writing" | "mixed";
  severity: "low" | "medium" | "high";
};

function clampScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeSeverity(value: unknown): IntegrityFlag["severity"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeAction(value: unknown): IntegrityFlag["recommended_action"] {
  return value === "clear" || value === "review" || value === "investigate" ? value : "review";
}

function normalizeType(value: unknown): IntegrityFlag["integrity_type"] {
  return value === "similarity" || value === "ai-writing" || value === "mixed" ? value : "mixed";
}

function enforceScoreBand(score: number, min: number, max: number) {
  return Math.max(min, Math.min(max, score));
}

function normalizeScoresByContext(
  similarityScore: number,
  aiSuspicionScore: number,
  severity: IntegrityFlag["severity"],
  integrityType: IntegrityFlag["integrity_type"],
  recommendedAction: IntegrityFlag["recommended_action"],
) {
  let normalizedSimilarity = similarityScore;
  let normalizedAi = aiSuspicionScore;

  if (integrityType === "similarity" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 75, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 45, 74);
    } else {
      normalizedSimilarity = enforceScoreBand(normalizedSimilarity, 0, 44);
    }
  }

  if (integrityType === "ai-writing" || integrityType === "mixed") {
    if (severity === "high" || recommendedAction === "investigate") {
      normalizedAi = enforceScoreBand(normalizedAi, 75, 100);
    } else if (severity === "medium" || recommendedAction === "review") {
      normalizedAi = enforceScoreBand(normalizedAi, 45, 74);
    } else {
      normalizedAi = enforceScoreBand(normalizedAi, 0, 44);
    }
  }

  return {
    similarity: normalizedSimilarity,
    ai: normalizedAi,
  };
}

function normalizeFlags(flags: unknown, submissions: Array<{ id: string; student_name: string | null }>): IntegrityFlag[] {
  if (!Array.isArray(flags)) return [];

  return flags
    .map((flag) => {
      if (!flag || typeof flag !== "object") return null;
      const candidate = flag as Record<string, unknown>;
      const submissionAId = typeof candidate.submission_a_id === "string" ? candidate.submission_a_id : "";
      const submissionBId =
        typeof candidate.submission_b_id === "string"
          ? candidate.submission_b_id
          : submissionAId;
      const submissionA = submissions.find((entry) => entry.id === submissionAId);
      const submissionB = submissions.find((entry) => entry.id === submissionBId);

      const reason =
        typeof candidate.reason === "string" && candidate.reason.trim()
          ? candidate.reason.trim()
          : "Potential integrity issue detected.";

      const severity = normalizeSeverity(candidate.severity);
      const recommendedAction = normalizeAction(candidate.recommended_action);
      const integrityType = normalizeType(candidate.integrity_type);
      const normalizedScores = normalizeScoresByContext(
        clampScore(candidate.similarity_score),
        clampScore(candidate.ai_suspicion_score),
        severity,
        integrityType,
        recommendedAction,
      );

      return {
        student_a:
          (typeof candidate.student_a === "string" && candidate.student_a.trim()) ||
          submissionA?.student_name ||
          "Student A",
        student_b:
          (typeof candidate.student_b === "string" && candidate.student_b.trim()) ||
          submissionB?.student_name ||
          (submissionAId === submissionBId ? "AI-writing analysis" : "Student B"),
        submission_a_id: submissionAId,
        submission_b_id: submissionBId,
        similarity_score: normalizedScores.similarity,
        ai_suspicion_score: normalizedScores.ai,
        reason,
        evidence_summary:
          typeof candidate.evidence_summary === "string" && candidate.evidence_summary.trim()
            ? candidate.evidence_summary.trim()
            : reason,
        matched_excerpt:
          typeof candidate.matched_excerpt === "string" ? candidate.matched_excerpt.trim() : "",
        recommended_action: recommendedAction,
        integrity_type: integrityType,
        severity,
      } satisfies IntegrityFlag;
    })
    .filter((flag): flag is IntegrityFlag => Boolean(flag))
    .filter((flag) => flag.similarity_score > 0 || flag.ai_suspicion_score > 0);
}

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

function isPdfSubmission(sub: { file_name?: string }, content: string) {
  return sub.file_name?.toLowerCase().endsWith(".pdf") || content.startsWith("JVBER");
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
      ? `You are an academic integrity detection assistant integrated into an academic grading platform.

Your role is to analyse submitted student assignments and identify signs that the work may have been generated or heavily assisted by artificial intelligence.

IMPORTANT:
- Never make absolute accusations.
- Only provide a suspicion/risk score and reasoning.
- Flag work for lecturer review if suspicion is moderate/high.
- Base judgement on multiple indicators, not one factor alone.
- Do not treat strong grammar, formal academic tone, or high-quality writing alone as evidence of AI use.
- Do not assign moderate or high risk unless at least two categories show meaningful concern.

Analyse the submission across the following categories:

1. WRITING STYLE CONSISTENCY
- Unnaturally perfect grammar throughout
- Uniform sentence lengths/structures
- Repetitive sentence openings
- Overly polished or robotic academic tone
- Lack of natural human imperfection/errors
- Inconsistent style compared to expected student level

2. CONTENT QUALITY / DEPTH
- Generic or vague statements
- Surface-level analysis lacking deep critical thought
- Textbook-like explanations without originality
- Over-explanation of simple concepts
- Lack of nuanced reasoning
- Lack of unique insight/personal interpretation

3. STRUCTURAL PATTERNS
- Overly formulaic structure
- Paragraphs that are unnaturally symmetrical/perfectly balanced
- Transitions that feel artificially smooth
- Generic and reusable introduction/conclusion

4. LANGUAGE / VOCABULARY
- Vocabulary unusually advanced for academic level
- Forced or unnatural phrasing
- Overuse of transition words like "Furthermore", "Moreover", or "Additionally"
- Buzzword-heavy language lacking substance

5. SOURCE / CITATION ISSUES
- Fabricated references/citations
- Misquoted or unverifiable sources
- Generic references without specificity
- Weak quote analysis despite advanced referencing

6. AUTHENTICITY / HUMANITY
- Lack of personality or authentic voice
- No evidence of creative or original thought
- No drafting imperfections or rough reasoning
- No personal or individual style visible

SCORING MODEL:
- Writing Style Consistency: 20%
- Content Quality / Depth: 20%
- Structural Patterns: 15%
- Language / Vocabulary: 15%
- Citation Issues: 10%
- Authenticity / Humanity: 20%

Return a structured suspicion score only. Never state that AI was definitively used.`
      : `You are an academic integrity analyst. Compare submissions for suspicious similarity and also evaluate each submission for AI-generated writing indicators.

Rules:
- Never make absolute accusations.
- Only provide risk scores and evidence-based reasoning.
- Similarity concerns must be based on substantive overlap in student-authored content.
- AI-writing concerns must be based on multiple indicators, not a single stylistic feature.
- Do not treat strong grammar, formal academic tone, or high-quality writing alone as evidence of AI use.
- For AI-writing, do not assign moderate or high risk unless at least two categories show meaningful concern.`;

    let userPrompt: string;
    const userContent: Array<Record<string, string>> = [];

    if (isSingleMode) {
      const sub = submissions[0];
      const content = fileContents[0];
      const isPdf = isPdfSubmission(sub, content);

      userPrompt = `Analyse this student submission for signs of AI-generated or AI-assisted writing.

Student: ${sub.student_name || "Anonymous"}
File: ${sub.file_name}

${!isPdf ? `Content:\n${content.substring(0, 15000)}` : "The PDF document is attached."}

Apply the scoring model exactly and review:
- Writing Style Consistency
- Content Quality / Depth
- Structural Patterns
- Language / Vocabulary
- Citation Issues
- Authenticity / Humanity

Return a single structured flag only if there is a genuine integrity concern. If the submission looks normal, return no flags.`;

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
      const submissionSummaries = submissions.map((s: { id: string; student_name: string | null; file_name: string }, i: number) => {
        const content = fileContents[i] || "";
        const pdf = isPdfSubmission(s, content);
        if (pdf) {
          return `${i + 1}. ${s.student_name} - ${s.file_name} (PDF attached separately, submission id: ${s.id})`;
        }

        const excerpt = content ? content.substring(0, 8000) : "[content unavailable]";
        return `${i + 1}. ${s.student_name} - ${s.file_name} (submission id: ${s.id})\nReadable text excerpt:\n${excerpt}`;
      });

      userPrompt = `Analyse these ${submissions.length} student submissions for the same assignment. Check for suspicious similarity between submissions and for AI-generated writing patterns in each one.

Important rules:
1. Compare student-authored content only.
2. Ignore PDF metadata, object streams, file boilerplate, export-tool signatures, and template-only overlap.
3. Only flag similarity when the substantive written answer content overlaps suspiciously.
4. Only flag AI-writing when the prose itself shows meaningful machine-generated patterns.
5. If the files are PDFs, use the attached PDF documents as the primary source of truth.
6. For AI-writing suspicion, use the structured scoring model:
   - Writing Style Consistency: 20%
   - Content Quality / Depth: 20%
   - Structural Patterns: 15%
   - Language / Vocabulary: 15%
   - Citation Issues: 10%
   - Authenticity / Humanity: 20%
7. Do not assign moderate or high AI-writing risk unless at least two categories show meaningful concern.

Submissions:
${submissionSummaries.join("\n\n---\n\n")}

Analyse the content carefully. Only flag real concerns, explain the evidence, and recommend whether the lecturer should clear, review, or investigate.`;
      userContent.push({ type: "input_text", text: `${userPrompt}\n\nReturn valid JSON only.` });

      submissions.forEach((sub, i) => {
        const content = fileContents[i] || "";
        if (isPdfSubmission(sub, content) && content) {
          userContent.push({
            type: "input_file",
            filename: sub.file_name || `submission-${i + 1}.pdf`,
            file_data: `data:application/pdf;base64,${content}`,
          });
        }
      });
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
                    ai_suspicion_score: { type: "number" },
                    reason: { type: "string" },
                    evidence_summary: { type: "string" },
                    matched_excerpt: { type: "string" },
                    recommended_action: { type: "string", enum: ["clear", "review", "investigate"] },
                    integrity_type: { type: "string", enum: ["similarity", "ai-writing", "mixed"] },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                  },
                  required: ["student_a", "student_b", "submission_a_id", "submission_b_id", "similarity_score", "ai_suspicion_score", "reason", "evidence_summary", "matched_excerpt", "recommended_action", "integrity_type", "severity"],
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

    let result = { flags: [] as IntegrityFlag[], summary: "Analysis complete" };
    try {
      const parsed = parseJsonText(extractOutputText(aiData));
      result = {
        flags: normalizeFlags(parsed?.flags, submissions),
        summary:
          typeof parsed?.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : "Analysis complete",
      };
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
