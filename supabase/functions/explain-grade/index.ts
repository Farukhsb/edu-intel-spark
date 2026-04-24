import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { jsonError, requireUser } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { createChatCompletion, getModel } from "../_shared/openai.ts";

const ExplainGradeRequestSchema = z.object({
  submissionId: z.string().uuid().optional(),
  submissionIds: z.array(z.string().uuid()).max(50).optional(),
  message: z.string().min(1).max(2000),
});

type ExplainGradeMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function isExplainGradeMessage(value: unknown): value is ExplainGradeMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;

  return (
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    typeof message.content === "string"
  );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireUser(req);
    const body = await req.json().catch(() => null);
    const payload = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const rawMessages = Array.isArray(payload?.messages) ? payload.messages.filter(isExplainGradeMessage) : [];
    const latestUserMessage = [...rawMessages].reverse().find((entry) => entry.role === "user");

    const parsed = ExplainGradeRequestSchema.safeParse({
      submissionId: typeof payload?.submissionId === "string" ? payload.submissionId : undefined,
      submissionIds: Array.isArray(payload?.submissionIds)
        ? payload.submissionIds.filter((value): value is string => typeof value === "string")
        : undefined,
      message: typeof payload?.message === "string" ? payload.message : latestUserMessage?.content,
    });

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

    const { submissionId, submissionIds, message } = parsed.data;
    const messages = rawMessages.length > 0
      ? rawMessages
      : [{ role: "user", content: message } satisfies ExplainGradeMessage];
    const gradeContext = payload?.gradeContext;
    const chatModel = getModel("OPENAI_CHAT_MODEL", "gpt-5.4-mini");

    const systemPrompt = `You are GradeAI, a supportive academic grade assistant for university students. You use the Socratic method to help students reflect on their work and understand their grades.

Current grade context:
${JSON.stringify(gradeContext, null, 2)}

Guidelines:
- Use the Socratic method: ask guiding questions instead of giving direct answers
- Instead of "Your essay lacked structure", ask "What do you think was the strongest part of your argument?"
- Instead of "You lost marks on testing", ask "How did you decide which test cases to include?"
- Help students discover insights about their work through reflection
- Reference specific components from their grade breakdown
- Be encouraging and supportive
- Use markdown formatting for clarity
- Keep responses focused and under 300 words
- If asked about topics outside grade explanation, politely redirect`;

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
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("explain-grade error:", e);
    return jsonError(e, corsHeaders);
  }
});
