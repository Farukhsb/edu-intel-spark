import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, HttpError, jsonError, requireUser } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { buildReleasedGradeContext } from "../_shared/explain-grade-context.ts";
import { parseExplainGradeRequestPayload } from "../_shared/explain-grade-request.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { logError, logWarn } from "../_shared/log.ts";
import { createChatCompletion, getModel } from "../_shared/openai.ts";
import {
  buildExplainGradeSystemPrompt,
  buildWeaknessRankingResponse,
  hasWeaknessIntent,
} from "../_shared/explain-grade-prompt.ts";
import { applySharedRateLimit, createRateLimitResponse } from "../_shared/rate-limit.ts";

function createSseResponse(content: string, corsHeaders: HeadersInit) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const methodError = requirePostMethod(req, corsHeaders);
  if (methodError) return methodError;

  try {
    const { supabase: userSupabase, user } = await requireUser(req);
    const admin = createAdminClient();
    const rateLimit = await applySharedRateLimit(admin, req, {
      scope: "explain-grade",
      limit: 12,
      windowMs: 60_000,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      logWarn("Rate limit exceeded", { function: "explain-grade", identifierType: rateLimit.identifierType });
      return createRateLimitResponse(corsHeaders, rateLimit.retryAfterSeconds);
    }
    const body = await req.json().catch(() => null);
    const parsed = parseExplainGradeRequestPayload(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { submissionId, message, messages } = parsed.data;
    const { data: submission, error: submissionError } = await userSupabase
      .from("submissions")
      .select("id, assignment_id, student_id, student_name, student_email, file_name, status")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError) {
      throw new Error("Failed to load submission");
    }

    const { data: grade, error: gradeError } = await userSupabase
      .from("grades")
      .select("id, submission_id, ai_score, final_score, ai_feedback, ai_breakdown, grading_confidence")
      .eq("submission_id", submissionId)
      .maybeSingle();

    if (gradeError) {
      throw new Error("Failed to load released grade");
    }

    const assignmentId = typeof submission?.assignment_id === "string" ? submission.assignment_id : null;
    const { data: assignment, error: assignmentError } = assignmentId
      ? await userSupabase
          .from("assignments")
          .select("id, title, module_code, max_score")
          .eq("id", assignmentId)
          .maybeSingle()
      : { data: null, error: null };

    if (assignmentError) {
      throw new Error("Failed to load assignment context");
    }

    const gradeContext = buildReleasedGradeContext(
      { submission, grade, assignment },
      user.id,
      (status, errorMessage) => new HttpError(status, errorMessage),
    );
    const chatModel = getModel("OPENAI_CHAT_MODEL", "gpt-4o-mini");
    const latestUserQuestion = [...messages].reverse().find((entry) => entry.role === "user")?.content ?? message;
    if (hasWeaknessIntent(latestUserQuestion)) {
      return createSseResponse(
        buildWeaknessRankingResponse(gradeContext.weakestCriterion, gradeContext.criterionInsights),
        corsHeaders,
      );
    }
    const systemPrompt = buildExplainGradeSystemPrompt(gradeContext, latestUserQuestion);

    const response = await createChatCompletion({
      model: chatModel,
      messages: [
        { role: "developer", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await response.text();
      logError("OpenAI error", undefined, { function: "explain-grade", status: response.status });
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    logError("explain-grade error", e);
    return jsonError(e, corsHeaders);
  }
});
